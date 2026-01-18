# Plan d'implémentation - Assistant Déclaration TVA

## Objectif
Créer une page d'aide à la déclaration de TVA mensuelle qui calcule automatiquement les montants pour chaque case du formulaire officiel, basé sur les encaissements et dépenses du mois.

---

## Étape 1 : Vérification des règles fiscales

### Contexte
- **Statut** : Micro-entreprise
- **Régime TVA** : Réel simplifié mensuel (CA3)
- **Base de calcul CA** : Encaissements (et non facturation) - conforme au régime micro-entreprise

### Cases à remplir et règles déclarées

| Case | Description | Règle déclarée | Validation |
|------|-------------|----------------|------------|
| **A1** | Chiffre d'affaires | Montant encaissé du mois | ✅ Correct - En micro-entreprise, la TVA est déclarée sur les encaissements |
| **B2** | Achats intra-UE HT | Total achats Europe HT | ✅ Correct - Achats intracommunautaires soumis à auto-liquidation |
| **08** | Base HT à 20% | CA à 20% + B2 | ✅ Correct - La base inclut le CA taxable + acquisitions intra-UE |
| **17** | TVA sur acquisitions intra-UE | 20% de B2 | ✅ Correct - TVA auto-liquidée sur achats intra-UE |
| **19** | TVA déductible sur immobilisations | Achats > 500€ HT | ⚠️ Partiellement correct - Voir note ci-dessous |
| **20** | Autre TVA à déduire | TVA déductible + case 17 | ✅ Correct - TVA sur achats + TVA auto-liquidée (neutralisation) |

### Notes importantes

#### Case 19 - TVA déductible sur immobilisations
La règle "achats > 500€ HT" est une simplification. En réalité :
- La case 19 concerne les **immobilisations** (biens durables utilisés plus d'un an)
- Le seuil de 500€ HT correspond au seuil d'immobilisation obligatoire en comptabilité
- En micro-entreprise avec option TVA, vous pouvez déduire la TVA sur :
  - Les immobilisations (matériel informatique, véhicule professionnel, etc.)
  - Les biens d'une valeur > 500€ HT sont généralement des immobilisations

**Recommandation** : Conserver cette règle comme approximation, mais ajouter un flag "immobilisation" sur les dépenses pour plus de précision si besoin à l'avenir.

#### Case 20 - Autre TVA déductible
Inclut :
- TVA sur achats courants (fournitures, services, etc.) - dépenses < 500€ HT
- TVA auto-liquidée sur acquisitions intra-UE (case 17) - pour neutraliser l'effet

### Schéma de calcul TVA à payer/rembourser
```
TVA collectée = Case 08 × 20%
TVA déductible = Case 19 + Case 20
TVA nette = TVA collectée - TVA déductible
```

---

## Étape 2 : Modifications du schéma de base de données

### Modification de la table `expenses`
Ajouter un champ pour identifier les achats intra-UE :

```typescript
// Nouveau champ à ajouter dans src/server/db/schema.ts
isIntraEu: boolean('is_intra_eu').notNull().default(false), // Achat intra-UE (auto-liquidation)
```

---

## Étape 3 : Backend - Nouvelle route API

### Endpoint : `GET /api/tva/declaration/:month`

**Paramètres** :
- `month` : Format YYYY-MM

**Réponse** :
```typescript
interface TvaDeclarationResponse {
  month: string;

  // Cases du formulaire (arrondies à l'unité)
  cases: {
    A1: number;  // CA encaissé HT
    B2: number;  // Achats intra-UE HT
    case08: number;  // Base HT 20% (A1 + B2)
    case17: number;  // TVA intra-UE (20% de B2)
    case19: number;  // TVA déductible immobilisations (> 500€ HT)
    case20: number;  // Autre TVA déductible (≤ 500€ HT) + case17
  };

  // Détails pour affichage
  details: {
    invoicesPaid: Invoice[];           // Factures encaissées ce mois
    expensesWithTva: Expense[];        // Dépenses avec TVA récupérable (≤ 500€ HT)
    expensesIntraEu: Expense[];        // Achats intra-UE
    expensesOver500: Expense[];        // Dépenses > 500€ HT (immobilisations)
  };

  // Résumé
  summary: {
    tvaCollected: number;    // TVA collectée (20% de case08)
    tvaDeductible: number;   // TVA déductible totale (case19 + case20)
    tvaNet: number;          // TVA à payer (ou crédit si négatif)
  };
}
```

### Logique de calcul

```typescript
// A1 : CA encaissé du mois (factures avec paymentDate dans le mois)
const invoicesPaid = invoices.filter(i =>
  i.paymentDate >= premierDuMois &&
  i.paymentDate <= dernierDuMois &&
  !i.isCanceled
);
const A1 = Math.round(sum(invoicesPaid.map(i => i.amountHt)));

// B2 : Achats intra-UE
const expensesIntraEu = expenses.filter(e =>
  e.isIntraEu &&
  e.date >= premierDuMois &&
  e.date <= dernierDuMois
);
const B2 = Math.round(sum(expensesIntraEu.map(e => e.amountHt)));

// Case 08 : Base HT 20%
const case08 = A1 + B2;

// Case 17 : TVA sur intra-UE (20% de B2)
const case17 = Math.round(B2 * 0.20);

// Case 19 : TVA déductible immobilisations (> 500€ HT, hors intra-UE)
const expensesOver500 = expenses.filter(e =>
  e.date >= premierDuMois &&
  e.date <= dernierDuMois &&
  parseFloat(e.amountHt) > 500 &&
  !e.isIntraEu
);
const case19 = Math.round(sum(expensesOver500.map(e =>
  parseFloat(e.taxAmount) * (parseFloat(e.taxRecoveryRate) / 100)
)));

// Case 20 : Autre TVA déductible (≤ 500€ HT) + case 17
const expensesUnder500 = expenses.filter(e =>
  e.date >= premierDuMois &&
  e.date <= dernierDuMois &&
  parseFloat(e.amountHt) <= 500 &&
  parseFloat(e.taxAmount) > 0 &&
  !e.isIntraEu
);
const tvaDeductibleOther = sum(expensesUnder500.map(e =>
  parseFloat(e.taxAmount) * (parseFloat(e.taxRecoveryRate) / 100)
));
const case20 = Math.round(tvaDeductibleOther + case17);

// Résumé
const tvaCollected = Math.round(case08 * 0.20);
const tvaDeductible = case19 + case20;
const tvaNet = tvaCollected - tvaDeductible;
```

---

## Étape 4 : Frontend - Page Assistant TVA

### Composants à créer

1. **`TvaDeclarationPage.tsx`** - Page principale dans `src/client/pages/`

### Structure de la page
```
┌─────────────────────────────────────────────────────┐
│  Assistant Déclaration TVA                          │
│  [← ] Décembre 2025 [ →]                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  CASES À REMPLIR                                    │
│  ┌─────────┬─────────┬─────────┬─────────┐        │
│  │ A1      │ B2      │ 08      │ 17      │        │
│  │ 5 000 € │ 200 €   │ 5 200 € │ 40 €    │        │
│  └─────────┴─────────┴─────────┴─────────┘        │
│  ┌─────────┬─────────┬─────────────────────┐      │
│  │ 19      │ 20      │ TVA nette           │      │
│  │ 120 €   │ 80 €    │ 840 € à payer       │      │
│  └─────────┴─────────┴─────────────────────┘      │
│                                                     │
├─────────────────────────────────────────────────────┤
│  DÉTAILS DU MOIS                                    │
│                                                     │
│  ▼ Encaissements (3)                    5 000 € HT │
│    • Client A - Facture #123           2 000 €     │
│    • Client B - Facture #124           1 500 €     │
│    • Client C - Facture #125           1 500 €     │
│                                                     │
│  ▼ Achats intra-UE (1)                   200 € HT │
│    • Service Cloud AWS                   200 €     │
│                                                     │
│  ▼ Dépenses avec TVA ≤ 500€ (5)         80 € TVA  │
│    • Fournitures bureau                  20 €     │
│    • ...                                           │
│                                                     │
│  ▼ Immobilisations > 500€ (1)          120 € TVA  │
│    • MacBook Pro                        120 €     │
└─────────────────────────────────────────────────────┘
```

---

## Étape 5 : Modification du formulaire de dépenses

### Ajout du flag "Achat intra-UE"

Dans le formulaire d'ajout/modification de dépense (`ExpenseForm` ou similaire) :
- Ajouter une checkbox "Achat intracommunautaire (auto-liquidation TVA)"
- Quand coché :
  - Le montant TVA devrait être à 0 (pas de TVA payée au fournisseur)
  - Afficher une info-bulle explicative

---

## Étape 6 : Navigation

Ajouter un lien vers la nouvelle page dans le menu :
- Dans la section TVA existante ou comme nouvel item "Déclaration TVA"

---

## Ordre d'implémentation

1. [ ] **Migration DB** : Ajouter `isIntraEu` à la table `expenses`
2. [ ] **Shared Types** : Mettre à jour les types dans `src/shared/types.ts`
3. [ ] **Backend** : Modifier les routes expenses pour supporter `isIntraEu`
4. [ ] **Backend** : Créer la route `GET /api/tva/declaration/:month`
5. [ ] **Frontend** : Modifier le formulaire de dépenses (checkbox intra-UE)
6. [ ] **Frontend** : Créer la page `TvaDeclarationPage.tsx`
7. [ ] **Navigation** : Ajouter le lien dans le menu/sidebar

---

## Questions à considérer

1. Faut-il gérer d'autres taux de TVA (10%, 5.5%) ou uniquement 20% ?
2. Souhaitez-vous un flag "immobilisation" explicite plutôt que la règle > 500€ ?
3. Export des données (PDF/CSV) pour archivage ?

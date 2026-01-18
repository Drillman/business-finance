I want to create an web app to track my business finance, that I currently do with an excel document. Note that the current solution is in french, the new one should have a french display but the code is english. With my current business, every thing is based on the amount payed not the amount billed

## Current solution

My current solution to track my business finances is done through an excel documents, with the following sheets :

- Chiffre d'affaire : That the sheet where I list the invoices that I produce with : client, description, invoice date, payment date, amount without tax, tax percentage, amount with tax, invoice number and an optional note. I also have a view for each month : revenue, tax total, Urssaf amount, impôt, remaining (revenue - urssaf - impôt).
- TVA : The sheet where I overview all my taxes : Taxes owed, amount I can get back for each month, business expenses where I can get the taxes back (description, date, tax amount, back percentage some taxes I can only get 80% back), Taxes payments (status, amount, reference, date of payment, optional note)
- Urssaf: Line for each trimester with revenue, Urssaf amount, payment with details. Overview on the year. Note that I have a fixed percentage for the urssaf amount on the revenue.
- Business account : That sheet I enter the bank account balance, substract the Urssaf I owed where the payment is not made, taxes owed where the payment is not made, next month salary (3000 euros) to see what I can actually use.
- Impôts : A sheet where I can estimate my personnal income impôts that is tied to my business revenue and also track the current impôts I owe with my business revenue. With some customisation possible to add things.
- Calcul prestation : A quick sheet to calculate the actual amount I will get if I bill something. I can enter either the amount with or without taxes, substract the urssaf amount and the impôts to see what is left.
- Base : A sheet to configure all the constant of the file : Urssaf percentage on the revenue, impôt percentage on the revenue I estimate for the year (use in the chiffre d'affaire page), the percentage of the revenue I can deduct for the impôt calculation (the taxable income), the impôt brackets, fixed monthly business expenses (insurance, health insurance).

### Flaws

I want to improve a few things from the current solution :

- A better overview of my business situation, currently a lot of sheets, tidius to configure with multiple sheets
- A way to handle the business expenses. Currently I only define fixed monthly expenses, some expenses only in the taxe part. I want a single interface to handle the expenses

## Tech stack

I want a react based app with a Postgres DB. Use tailwindCSS with daisyUI. Use the latest version of each package

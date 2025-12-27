import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Invoices from './pages/Invoices'
import Expenses from './pages/Expenses'
import TVA from './pages/TVA'
import Urssaf from './pages/Urssaf'
import BusinessAccount from './pages/BusinessAccount'
import IncomeTax from './pages/IncomeTax'
import Calculator from './pages/Calculator'
import Settings from './pages/Settings'
import ManagePasskeys from './pages/ManagePasskeys'
import Login from './pages/Login'
import Register from './pages/Register'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="tva" element={<TVA />} />
        <Route path="urssaf" element={<Urssaf />} />
        <Route path="account" element={<BusinessAccount />} />
        <Route path="income-tax" element={<IncomeTax />} />
        <Route path="calculator" element={<Calculator />} />
        <Route path="settings" element={<Settings />} />
        <Route path="passkeys" element={<ManagePasskeys />} />
      </Route>
    </Routes>
  )
}

export default App

import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Finance from "./pages/Finance";
import Clients from "./pages/Clients";
import Projects from "./pages/Projects";
import Invoice from "./pages/Invoice";
import Goals from "./pages/Goals";
import Settings from "./pages/Settings";

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    path: "/",
    element: <ProtectedRoute><Layout /></ProtectedRoute>,
    children: [
      { index: true, Component: Dashboard },
      { path: "finance", Component: Finance },
      { path: "clients", Component: Clients },
      { path: "projects", Component: Projects },
      { path: "invoice", Component: Invoice },
      { path: "goals", Component: Goals },
      { path: "settings", Component: Settings },
    ],
  },
]);

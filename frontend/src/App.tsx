import AppRoutes from './routes/AppRoutes'
import { ToastContainer } from 'react-toastify'
import GlobalApiLoading from './components/loading/GlobalApiLoading'
import 'react-toastify/dist/ReactToastify.css'

function App() {
  return (
    <>
      <GlobalApiLoading />
      <AppRoutes />
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  )
}

export default App

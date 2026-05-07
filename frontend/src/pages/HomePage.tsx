import { useNavigate } from 'react-router-dom'

function HomePage() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username')

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('username')
    navigate('/login')
  }

  return (
    <div className="home-container">
      <h1>Trang Home</h1>
      <p>Xin chào {username || 'bạn'}!</p>
      <button onClick={handleLogout}>Đăng xuất</button>
    </div>
  )
}

export default HomePage
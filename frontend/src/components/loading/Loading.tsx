import './Style.css'

type LoadingProps = {
  text?: string
  fullScreen?: boolean
}

function Loading({
  text = 'Đang tải dữ liệu...',
  fullScreen = false,
}: LoadingProps) {
  return (
    <div className={fullScreen ? 'loading-overlay' : 'loading-inline'}>
      <div className="loading-box">
        <div className="loading-spinner"></div>
        <p className="loading-text">{text}</p>
      </div>
    </div>
  )
}

export default Loading
import './RoleFeaturePage.css'

type RoleFeaturePageProps = {
  className?: string
  title: string
  description: string
  highlights?: string[]
}

function RoleFeaturePage({
  className = '',
  title,
  description,
  highlights = [],
}: RoleFeaturePageProps) {
  const sectionClassName = className
    ? `${className} role-feature-page role-page-stack`
    : 'role-feature-page role-page-stack'

  return (
    <section className={sectionClassName}>
      <article className="role-card">
        <h2>{title}</h2>
        <p className="role-muted">{description}</p>
      </article>

      {!!highlights.length && (
        <article className="role-card">
          <h3>Highlights</h3>
          <ul className="role-list">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      )}
    </section>
  )
}

export default RoleFeaturePage

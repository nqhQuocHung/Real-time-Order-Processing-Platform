type RoleFeaturePageProps = {
  title: string
  description: string
  highlights?: string[]
}

function RoleFeaturePage({
  title,
  description,
  highlights = [],
}: RoleFeaturePageProps) {
  return (
    <section className="role-page-stack">
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

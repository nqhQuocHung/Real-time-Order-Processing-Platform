import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageTransition from '../../../components/transition/PageTransition'
import realtimeLogo from '../../../assets/logo/RealtimeLogo.png'
import vnptBackground from '../../../assets/logo/vnpt_bg.png'
import architectureModel1 from '../../../assets/illustrations/architecture-model-1.png'
import architectureModel2 from '../../../assets/illustrations/architecture-model-2.png'
import architectureModel3 from '../../../assets/illustrations/architecture-model-3.png'
import architectureModel4 from '../../../assets/illustrations/architecture-model-4.png'
import { useI18n } from '../../../i18n/I18nProvider'
import './AboutPage.css'

type ServiceCard = {
  name: string
  overview: string
  responsibility: string
  highlights: string[]
}

type FlowStep = {
  title: string
  description: string
}

type TechnologyItem = {
  name: string
  note: string
}

type DiagramItem = {
  title: string
  image: string
  alt: string
  highlights: string[]
}

function AboutPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [selectedService, setSelectedService] = useState<ServiceCard | null>(null)

  const services = useMemo<ServiceCard[]>(
    () => [
      {
        name: 'Auth Service',
        overview: 'Identity and access management domain.',
        responsibility: 'Authentication, JWT issuance/refresh, RBAC (role-permission-menu), and partner request events.',
        highlights: [
          'Public endpoints under /api/v1/auth/** for login, register, token, profile.',
          'Publishes partner.request.created.v1 and partner.request.decided.v1.',
          'Maintains user/role/permission/menu access model.',
        ],
      },
      {
        name: 'Inventory Service',
        overview: 'Catalog, stock, and review management domain.',
        responsibility: 'Product catalog, category and stock management, reserve/release/confirm-deduct inventory APIs, and review events.',
        highlights: [
          'Owns product/category/stock data and reservation lifecycle.',
          'Provides internal APIs for reserve, release, and confirm-deduct.',
          'Publishes product.review.created/updated/comment.created events.',
        ],
      },
      {
        name: 'Order Service',
        overview: 'Core order orchestration domain.',
        responsibility: 'Order orchestration with idempotency, payment deadline handling, status history, and payment-event reconciliation.',
        highlights: [
          'Handles create-order state machine and timeline history.',
          'Consumes payment.transaction.succeeded/failed events.',
          'Publishes order.lifecycle.created/paid/completed/failed topics.',
        ],
      },
      {
        name: 'Payment Service',
        overview: 'Payment intent and transaction status domain.',
        responsibility: 'Payment intent creation, confirm/fail transaction handling, and Kafka transaction event publishing.',
        highlights: [
          'Exposes payment confirmation and failure handling endpoints.',
          'Uses Redis idempotency lock for confirm/fail actions.',
          'Publishes payment.transaction.succeeded.v1 and payment.transaction.failed.v1.',
        ],
      },
      {
        name: 'Notification Service',
        overview: 'Realtime notification and message delivery domain.',
        responsibility: 'Consumes order/payment/partner/review events, writes notification logs, resolves recipients, and pushes SSE/chat realtime.',
        highlights: [
          'Consumes business events and stores notification log entries.',
          'Pushes realtime updates through /api/v1/notifications/stream.',
          'Resolves recipients by order/review context and supports chat updates.',
        ],
      },
    ],
    [],
  )

  useEffect(() => {
    if (!selectedService) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedService(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [selectedService])

  const featuredFlows = useMemo<FlowStep[]>(
    () => [
      {
        title: 'Create order -> reserve stock -> payment intent',
        description: 'Client calls POST /api/v1/orders through the gateway. Order Service reserves inventory first, then calls Payment Service to create payment intent and deadline.',
      },
      {
        title: 'Payment success reconciliation',
        description: 'Client confirms payment at POST /api/v1/payments/confirm (Gateway -> Payment Service). Payment Service publishes payment.transaction.succeeded.v1, then Order Service consumes it and confirms deduct.',
      },
      {
        title: 'Fail/timeout compensation',
        description: 'On payment.transaction.failed.v1 or timeout scheduler, Order Service releases reserved inventory, marks order FAILED, and emits order.lifecycle.failed.v1.',
      },
      {
        title: 'Realtime notifications and deep-link',
        description: 'Notification Service consumes Kafka events and pushes SSE updates with navigation context so frontend can open exact order/review screens.',
      },
    ],
    [],
  )

  const technologies = useMemo<TechnologyItem[]>(
    () => [
      {
        name: 'Frontend',
        note: 'React + TypeScript + Vite, route guards, event-aware notification bell, and SSE stream listener.',
      },
      {
        name: 'Backend',
        note: 'Spring Boot microservices with REST public APIs and internal RPC protected by X-Internal-Token.',
      },
      {
        name: 'Messaging',
        note: 'Apache Kafka event bus using topic naming convention <domain>.<entity>.<event>.v1.',
      },
      {
        name: 'Realtime',
        note: 'Server-Sent Events from /api/v1/notifications/stream for notification and chat updates.',
      },
      {
        name: 'Data',
        note: 'PostgreSQL with one schema per service (auth, orders, inventory, payment, notification).',
      },
      {
        name: 'Platform',
        note: 'Redis for cache/idempotency lock and Docker Compose for local multi-service runtime.',
      },
    ],
    [],
  )

  const diagrams = useMemo<DiagramItem[]>(
    () => [
      {
        title: 'Model 1 - Overall architecture',
        image: architectureModel1,
        alt: 'Model 1 diagram showing gateway, services, PostgreSQL, Redis, Kafka, and SSE',
        highlights: [
          'Gateway is the only client entry point to /api/v1/* routes.',
          'Each service owns its PostgreSQL schema; cross-service sync uses RPC or events.',
          'Notification Service pushes realtime updates to frontend via SSE.',
        ],
      },
      {
        title: 'Model 2 - Domain responsibilities',
        image: architectureModel2,
        alt: 'Model 2 diagram showing functional split by microservices',
        highlights: [
          'Auth, Inventory, Order, Payment, and Notification responsibilities are separated by domain.',
          'Order Service coordinates state transitions and timeout scheduler.',
          'Kafka is used for async integration, while request/response remains through gateway/internal RPC.',
        ],
      },
      {
        title: 'Model 3 - Order and payment sequence',
        image: architectureModel3,
        alt: 'Model 3 sequence diagram from order creation to realtime notification',
        highlights: [
          'Payment confirmation starts at Payment Service, then publishes payment.transaction.succeeded.v1.',
          'Order Service consumes payment events and calls inventory confirm-deduct.',
          'order.lifecycle.paid.v1 and failed events are fanout to Notification Service for SSE delivery.',
        ],
      },
      {
        title: 'Model 4 - Kafka producer/consumer map',
        image: architectureModel4,
        alt: 'Model 4 diagram showing Kafka topics and producer consumer mapping',
        highlights: [
          'Primary producers are Auth, Order, Payment, and Inventory services.',
          'Notification Service is mainly a consumer for order/payment/partner/review topics.',
          'Chat realtime updates are pushed by SSE directly, not through a dedicated Kafka chat topic.',
        ],
      },
    ],
    [],
  )

  return (
    <PageTransition>
      <section
        className="about-page-shell"
        style={{ backgroundImage: `url(${vnptBackground})` }}
      >
        <div className="about-page-overlay">
          <div className="about-page-container">
            <header className="about-page-hero">
              <img src={realtimeLogo} alt="Realtime Logo" className="about-page-logo" />
              <div>
                <p className="about-page-kicker">Real-time Order Platform</p>
                <h1>{t('pages.commonAbout.title')}</h1>
                <p className="about-page-subtitle">
                  {t('pages.commonAbout.subtitle')}
                </p>
              </div>
            </header>

            <section className="about-page-section">
              <div className="about-page-section-header">
                <h2>{t('pages.commonAbout.sections.diagrams.title')}</h2>
                <span>{t('pages.commonAbout.sections.diagrams.subtitle')}</span>
              </div>
              <div className="about-page-diagram-grid">
                {diagrams.map((diagram) => (
                  <article key={diagram.title} className="about-page-diagram-card">
                    <h3>{diagram.title}</h3>
                    <img
                      src={diagram.image}
                      alt={diagram.alt}
                      className="about-page-architecture-image"
                      loading="lazy"
                    />
                    <ul className="about-page-diagram-highlights">
                      {diagram.highlights.map((highlight) => (
                        <li key={highlight}>{highlight}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className="about-page-section">
              <div className="about-page-section-header">
                <h2>{t('pages.commonAbout.sections.coreServices.title')}</h2>
                <span>{t('pages.commonAbout.sections.coreServices.subtitle')}</span>
              </div>
              <div className="about-page-service-grid">
                {services.map((service) => (
                  <button
                    key={service.name}
                    type="button"
                    className="about-page-card about-page-service-card"
                    onClick={() => setSelectedService(service)}
                  >
                    <h3>{service.name}</h3>
                    <p>{service.responsibility}</p>
                    <span className="about-page-service-hint">{t('pages.commonAbout.sections.coreServices.hint')}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="about-page-section">
              <div className="about-page-section-header">
                <h2>{t('pages.commonAbout.sections.featuredFlows.title')}</h2>
                <span>{t('pages.commonAbout.sections.featuredFlows.subtitle')}</span>
              </div>
              <ol className="about-page-flow-list">
                {featuredFlows.map((step) => (
                  <li key={step.title} className="about-page-flow-item">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="about-page-section about-page-technology">
              <div className="about-page-section-header">
                <h2>{t('pages.commonAbout.sections.technology.title')}</h2>
                <span>{t('pages.commonAbout.sections.technology.subtitle')}</span>
              </div>
              <div className="about-page-tech-grid">
                {technologies.map((technology) => (
                  <article key={technology.name} className="about-page-card">
                    <h3>{technology.name}</h3>
                    <p>{technology.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="about-page-section">
              <div className="about-page-section-header">
                <h2>{t('pages.commonAbout.sections.specs.title')}</h2>
                <span>{t('pages.commonAbout.sections.specs.subtitle')}</span>
              </div>
              <ul className="about-page-reference-list">
                <li><code>docs/architecture.md</code> - service boundaries, sync/async communication, storage, reliability.</li>
                <li><code>docs/key-flows.md</code> - order/payment/review/chat operational flows and sequence.</li>
                <li><code>docs/kafka-topics.md</code> - topic naming, producer/consumer mapping, envelope conventions.</li>
                <li><code>docs/system-functions.md</code> - functional capabilities across user roles and domains.</li>
              </ul>
            </section>

            <footer className="about-page-actions">
              <button
                type="button"
                className="about-page-btn about-page-btn-secondary"
                onClick={() => navigate('/register')}
              >
                {t('pages.commonAbout.actions.createAccount')}
              </button>
              <button
                type="button"
                className="about-page-btn about-page-btn-primary"
                onClick={() => navigate('/login')}
              >
                {t('pages.commonAbout.actions.backToLogin')}
              </button>
            </footer>
          </div>
        </div>

        {selectedService ? (
          <div
            className="about-page-modal-backdrop"
            role="presentation"
            onClick={() => setSelectedService(null)}
          >
            <section
              className="about-page-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="about-service-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="about-page-modal-header">
                <h3 id="about-service-title">{selectedService.name}</h3>
                <button
                  type="button"
                  className="about-page-modal-close"
                  aria-label={t('pages.commonAbout.actions.closeServiceOverview')}
                  onClick={() => setSelectedService(null)}
                >
                  x
                </button>
              </header>
              <p className="about-page-modal-overview">{selectedService.overview}</p>
              <p className="about-page-modal-summary">{selectedService.responsibility}</p>
              <ul className="about-page-modal-highlights">
                {selectedService.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </section>
    </PageTransition>
  )
}

export default AboutPage

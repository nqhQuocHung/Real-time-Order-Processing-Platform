import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageTransition from '../../../components/transition/PageTransition'
import realtimeLogo from '../../../assets/logo/RealtimeLogo.png'
import vnptBackground from '../../../assets/logo/vnpt_bg.png'
import architectureModel1 from '../../../assets/illustrations/architecture-model-1.png'
import architectureModel2 from '../../../assets/illustrations/architecture-model-2.png'
import architectureModel3 from '../../../assets/illustrations/architecture-model-3.png'
import architectureModel4 from '../../../assets/illustrations/architecture-model-4.png'
import architectureModel5 from '../../../assets/illustrations/architecture-model-5.png'
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
  verification: string
  highlights: string[]
}

type TransportStage = {
  step: string
  title: string
  protocol: string
  description: string
}

type CommunicationFact = {
  label: string
  value: string
  detail: string
}

function AboutPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [selectedService, setSelectedService] = useState<ServiceCard | null>(null)

  const services = useMemo<ServiceCard[]>(
    () => [
      {
        name: 'API Gateway',
        overview: 'Public edge, security, routing, and realtime protocol bridge.',
        responsibility: 'Validates JWTs, routes public REST APIs, subscribes to the internal notification gRPC stream, and exposes browser-compatible SSE.',
        highlights: [
          'Single public entry point on port 8080 through Spring Cloud Gateway.',
          'Creates an authenticated gRPC channel to Notification Service on port 9095.',
          'Maps JWT subject and roles into the internal Subscribe request.',
          'Bridges protobuf NotificationEvent messages to text/event-stream responses.',
        ],
      },
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
          'Provides token-protected internal JSON RPC APIs for reserve, release, confirm-deduct, and owner lookup.',
          'Publishes product.review.created/updated/comment.created events.',
        ],
      },
      {
        name: 'Order Service',
        overview: 'Core order orchestration domain.',
        responsibility: 'Order orchestration with idempotency, payment deadline handling, status history, and payment-event reconciliation.',
        highlights: [
          'Handles create-order state machine and timeline history.',
          'Calls Inventory and Payment internal APIs with HTTP/2-capable JSON RPC clients.',
          'Consumes payment.transaction.succeeded/failed events.',
          'Publishes order.lifecycle.created/paid/completed/failed topics.',
        ],
      },
      {
        name: 'Payment Service',
        overview: 'Payment intent and transaction status domain.',
        responsibility: 'VNPAY payment intent, callback, refund, idempotency, compensation, and Kafka transaction event handling.',
        highlights: [
          'Creates VNPAY payment URLs and validates provider callbacks.',
          'Uses Redis idempotency lock for confirm/fail actions.',
          'Supports refund results and failed/timeout compensation flows.',
          'Publishes payment.transaction.succeeded.v1 and payment.transaction.failed.v1.',
        ],
      },
      {
        name: 'Notification Service',
        overview: 'Realtime notification and message delivery domain.',
        responsibility: 'Consumes Kafka events, resolves recipients, and serves an internal gRPC server stream over HTTP/2.',
        highlights: [
          'Consumes business events and stores notification log entries.',
          'Implements NotificationStreamService/Subscribe as a unary-to-server-streaming RPC.',
          'Streams protobuf NotificationEvent messages over HTTP/2 on internal port 9095.',
          'Requires x-internal-token metadata before opening the gRPC stream.',
          'API Gateway bridges the internal gRPC stream to /api/v1/notifications/stream (SSE).',
          'Resolves recipients by order/refund/review context and supports chat updates.',
        ],
      },
    ],
    [],
  )

  const transportStages = useMemo<TransportStage[]>(
    () => [
      {
        step: '01',
        title: 'Domain events',
        protocol: 'Kafka',
        description: 'Order, payment, refund, partner, and review events enter the asynchronous realtime delivery path.',
      },
      {
        step: '02',
        title: 'Recipient fanout',
        protocol: 'Notification Service',
        description: 'Consumers persist notification logs and resolve customer, partner, or admin recipients from event context.',
      },
      {
        step: '03',
        title: 'Internal stream',
        protocol: 'gRPC + HTTP/2',
        description: 'NotificationStreamService/Subscribe continuously emits protobuf NotificationEvent messages on port 9095.',
      },
      {
        step: '04',
        title: 'Protocol bridge',
        protocol: 'API Gateway',
        description: 'The gateway authenticates the browser with JWT, subscribes internally, and converts each protobuf message to SSE.',
      },
      {
        step: '05',
        title: 'Browser delivery',
        protocol: 'SSE',
        description: 'React listens on GET /api/v1/notifications/stream and updates notifications, dashboards, and chat in real time.',
      },
    ],
    [],
  )

  const communicationFacts = useMemo<CommunicationFact[]>(
    () => [
      {
        label: 'RPC contract',
        value: 'NotificationStreamService/Subscribe',
        detail: 'Unary SubscribeRequest followed by a server stream of NotificationEvent messages.',
      },
      {
        label: 'Wire format',
        value: 'Protocol Buffers',
        detail: 'Carries event_id, event_name, data_json, and occurred_at_epoch_millis.',
      },
      {
        label: 'Transport',
        value: 'HTTP/2 (h2c locally)',
        detail: 'gRPC Java and Netty enforce HTTP/2 for the internal stream; production can terminate TLS or mTLS.',
      },
      {
        label: 'Internal security',
        value: 'x-internal-token',
        detail: 'A gRPC server interceptor rejects missing or invalid service-to-service metadata.',
      },
      {
        label: 'External security',
        value: 'JWT Bearer token',
        detail: 'Gateway derives userId and admin access from the authenticated JWT before subscribing.',
      },
      {
        label: 'Browser boundary',
        value: 'text/event-stream',
        detail: 'Browsers consume SSE; they never connect directly to the internal gRPC endpoint.',
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
        description: 'Notification Service consumes Kafka events, including order/payment/refund/review signals, and streams protobuf updates to API Gateway through gRPC/HTTP2. Gateway bridges them to SSE with navigation context for the frontend.',
      },
      {
        title: 'Partner recipient resolution',
        description: 'Notification Service calls token-protected Order and Inventory internal JSON RPC APIs to map order products to shop owners before targeted fanout.',
      },
      {
        title: 'Refund decision and compensation updates',
        description: 'Order Service publishes order.refund.* topics and calls Payment Service for refund execution. Payment Service publishes payment.refund.* topics, then Notification Service fans updates out through the realtime stream.',
      },
      {
        title: 'Realtime chat delivery',
        description: 'Chat messages are persisted by Notification Service and delivered to sender and recipient through the same gRPC-to-SSE stream without a dedicated chat Kafka topic.',
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
        note: 'Spring Boot microservices with REST public APIs, internal JSON RPC, and gRPC server-streaming protected by X-Internal-Token.',
      },
      {
        name: 'Messaging',
        note: 'Apache Kafka event bus using topic naming convention <domain>.<entity>.<event>.v1 for lifecycle, payment, refund, partner, and review events.',
      },
      {
        name: 'Realtime',
        note: 'Kafka -> Notification gRPC server stream over HTTP/2 -> Gateway SSE bridge -> React.',
      },
      {
        name: 'Transport',
        note: 'REST/JSON for public APIs, token-protected JSON RPC for synchronous service calls, and Protocol Buffers for gRPC streaming.',
      },
      {
        name: 'Data',
        note: 'PostgreSQL with one schema per service (auth, orders, inventory, payment, notification).',
      },
      {
        name: 'Payments',
        note: 'VNPAY payment URL, callback verification, refund processing, Redis idempotency, and compensation.',
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
        title: 'Model 1 - Overall System Architecture',
        image: architectureModel1,
        alt: 'Model 1 - Overall System Architecture showing clients, gateway, microservices, gRPC HTTP/2, Kafka, PostgreSQL, and Redis',
        verification: 'Verified against architecture, ports, and Docker Compose',
        highlights: [
          'Gateway is the only client entry point to /api/v1/* routes.',
          'Each service owns its PostgreSQL schema; cross-service sync uses RPC or events.',
          'Notification Service streams protobuf events to Gateway using gRPC/HTTP2; Gateway exposes SSE to the browser.',
        ],
      },
      {
        title: 'Model 2 - Realtime gRPC/HTTP2 to Browser SSE',
        image: architectureModel2,
        alt: 'Model 2 - Realtime Notification Transport from Kafka through gRPC HTTP/2 and API Gateway to browser SSE',
        verification: 'Verified against gRPC proto, gateway client, and notification server',
        highlights: [
          'The internal stream is a real gRPC server-streaming RPC running on HTTP/2.',
          'x-internal-token protects the service channel while JWT protects the public SSE endpoint.',
          'Gateway isolates browser clients from protobuf and internal service addressing.',
        ],
      },
      {
        title: 'Model 3 - System Functions and Domains',
        image: architectureModel3,
        alt: 'Model 3 - Domain Responsibilities showing functional boundaries across microservices',
        verification: 'Verified against service boundaries and public/internal routes',
        highlights: [
          'Auth, Inventory, Order, Payment, and Notification responsibilities are separated by domain.',
          'Order Service coordinates state transitions and timeout scheduler.',
          'Kafka is used for async integration, while request/response remains through gateway/internal RPC.',
        ],
      },
      {
        title: 'Model 4 - Order and Payment Processing Flow',
        image: architectureModel4,
        alt: 'Model 4 - Order and Payment Sequence from order creation to realtime notification',
        verification: 'Verified against key flows and payment/order consumers',
        highlights: [
          'Payment confirmation starts at Payment Service, then publishes payment.transaction.succeeded.v1.',
          'Order Service consumes payment events and calls inventory confirm-deduct.',
          'order.lifecycle.paid.v1 and failed events are fanout to Notification Service, then delivered through gRPC-to-SSE streaming.',
        ],
      },
      {
        title: 'Model 5 - Kafka Producer and Consumer Map',
        image: architectureModel5,
        alt: 'Model 5 - Kafka Producer and Consumer Map showing topics and service mappings',
        verification: 'Verified against Kafka topic docs and application properties',
        highlights: [
          'Primary producers are Auth, Order, Payment, and Inventory services.',
          'Notification Service consumes order, payment, refund, partner, and review topics.',
          'The diagram covers the main topic families; refund topics are also present in code as order.refund.* and payment.refund.*.',
          'Chat updates use the same gRPC-to-SSE stream path without a dedicated Kafka chat topic.',
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
                <div className="about-page-hero-badges" aria-label="Core platform technologies">
                  {['Spring Boot', 'Kafka', 'gRPC', 'HTTP/2', 'Protobuf', 'SSE', 'React'].map((badge) => (
                    <span key={badge}>{badge}</span>
                  ))}
                </div>
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
                    <header className="about-page-diagram-card-header">
                      <h3>{diagram.title}</h3>
                      <span>{diagram.verification}</span>
                    </header>
                    <figure className="about-page-diagram-figure">
                      <img
                        src={diagram.image}
                        alt={diagram.alt}
                        className="about-page-architecture-image"
                        loading="lazy"
                      />
                    </figure>
                    <ul className="about-page-diagram-highlights">
                      {diagram.highlights.map((highlight) => (
                        <li key={highlight}>{highlight}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className="about-page-section about-page-transport-section">
              <div className="about-page-section-header">
                <h2>{t('pages.commonAbout.sections.transport.title')}</h2>
                <span>{t('pages.commonAbout.sections.transport.subtitle')}</span>
              </div>

              <div className="about-page-transport-pipeline">
                {transportStages.map((stage, index) => (
                  <article key={stage.step} className="about-page-transport-stage">
                    <div className="about-page-transport-stage-heading">
                      <span className="about-page-transport-step">{stage.step}</span>
                      <span className="about-page-transport-protocol">{stage.protocol}</span>
                    </div>
                    <h3>{stage.title}</h3>
                    <p>{stage.description}</p>
                    {index < transportStages.length - 1 ? (
                      <span className="about-page-transport-arrow" aria-hidden="true">-&gt;</span>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="about-page-communication-facts">
                {communicationFacts.map((fact) => (
                  <article key={fact.label} className="about-page-communication-fact">
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                    <p>{fact.detail}</p>
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
                <li><code>services/notification-service/src/main/proto/notification_stream.proto</code> - gRPC server-streaming contract.</li>
                <li><code>docs/key-flows.md</code> - order/payment/review/chat operational flows and sequence.</li>
                <li><code>docs/kafka-topics.md</code> - topic naming, producer/consumer mapping, envelope conventions.</li>
                <li><code>docs/api-contracts.md</code> - public REST/SSE and internal gRPC transport contracts.</li>
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

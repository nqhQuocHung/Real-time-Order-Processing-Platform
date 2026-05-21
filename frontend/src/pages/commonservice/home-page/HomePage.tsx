import './HomePage.css'
import { useI18n } from '../../../i18n/I18nProvider'

function HomePage() {
  const { t } = useI18n()
  return <section className="home-page" aria-label={t('pages.commonHome.title')} />
}

export default HomePage

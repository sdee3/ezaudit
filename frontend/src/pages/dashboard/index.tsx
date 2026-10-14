import { Dashboard } from '../../modules/Dashboard'
import { useAuth } from '../../components'
import { Head } from '../../head'

const DashboardPage = () => {
  const { user } = useAuth()

  return (
    <>
      <Head title="Your Dashboard | EZ Audit" />
      <Dashboard user={user} />
    </>
  )
}

export default DashboardPage

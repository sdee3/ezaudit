import Head from 'next/head'
import { NextPage } from 'next/types'

import { User } from '../../models'
import { getCookieFromReq } from '../../utils'

interface Props {
  user: User | null
}

const DashboardPage: NextPage<Props> = ({ user }: Props) => {
  return (
    <>
      <Head>
        <title>Your Dashboard | EZ Audit</title>
      </Head>
    </>
  )
}

DashboardPage.getInitialProps = async ctx => {
  if (!ctx?.req?.headers?.cookie) return { user: null }
  const userCookie = getCookieFromReq(ctx.req, 'user')
  const user: User | null =
    userCookie?.length > 0 ? JSON.parse(userCookie) : null

  return { user }
}

export default DashboardPage

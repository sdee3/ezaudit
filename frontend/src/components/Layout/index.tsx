import { Fragment, ReactNode } from 'react'

import { Navbar } from '../Navbar'
import { Footer } from '../Footer'

export const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <Fragment>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </Fragment>
  )
}

import { Fragment } from 'react'

import { Navbar } from '../Navbar'
import { Footer } from '../Footer'

export const Layout = ({ children }) => {
  return (
    <Fragment>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </Fragment>
  )
}

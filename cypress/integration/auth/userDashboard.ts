import { UserData } from '../../types'

let cypressTestUser: UserData | null = null

beforeEach('load homepage', () => {
  cy.visit('/')
  cy.dataCy('submitAuditBtn').should('be.visible')
  cy.dataCy('submitAuditSiteInput').should('be.visible')
  cy.dataCy('submitAuditEmailInput').should('be.visible')

  cy.intercept('/api/audits', req => {
    req.reply({
      message: [],
    })
  })

  cy.intercept('/api/auth/login', req => {
    req.reply({ ...cypressTestUser })
  })

  cy.intercept('/api/auth/validate', req => {
    req.reply({ access_token: cypressTestUser.access_token })
  })
})

before(() => {
  cy.fixture('users').then(users => (cypressTestUser = users[0] as UserData))
})

it('sees a clickable user icon', () => {
  cy.dataCy('userDashboardBtn').should('be.visible')
  cy.dataCy('userDashboardBtn').should('not.be.disabled')
})

it('navigates to user dashboard, logs in, and sees an empty Audit list', () => {
  cy.dataCy('userDashboardBtn').click()
  cy.location('pathname').should('equal', '/dashboard')
  cy.dataCy('signInForm').should('be.visible')

  cy.dataCy('signInEmailInput').type((cypressTestUser as UserData).user.email)
  cy.dataCy('signInPasswordInput').type('password')

  cy.dataCy('signInSubmitButton').click()

  cy.dataCy('viewAuditsBtn').should('be.visible')
  cy.dataCy('viewAuditsBtn').click()

  cy.location('pathname').should('equal', '/dashboard/audits')
  cy.dataCy('noResultAs200').should('be.visible')
})

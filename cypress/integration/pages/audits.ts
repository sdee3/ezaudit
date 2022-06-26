let audits = null

before('load audits from JSON', () => {
  cy.fixture('audits.json').then(data => (audits = data.message))
})

beforeEach(() => {
  cy.intercept('/api/audits', req => {
    req.reply({
      message: audits,
    })
  })

  cy.task('clearNock')

  cy.visit('/dashboard/audits')
})

it('renders a table with audits', () => {
  cy.task('nock', {
    hostname: 'http://localhost:8000',
    method: 'GET',
    path: '/api/audits',
    statusCode: 200,
    body: {
      message: audits,
    },
  })

  cy.dataCy('auditsTable').should('be.visible')
})

it('opens an audit table row to view the audit in a separate page', () => {
  const auditId = audits[0].id

  cy.task('nock', {
    hostname: 'http://localhost:8000',
    method: 'GET',
    path: `/api/audits/${auditId}`,
    statusCode: 200,
    body: {
      message: audits[0],
    },
  })

  cy.dataCy(`auditTableRow${auditId}`).click()
  cy.location('pathname').should('equal', `/dashboard/audits/${auditId}`)
})

import postgres from 'postgres'

const sql = postgres('postgresql://swarm:swarm@localhost:5433/swarm_local', {
  max: 10,
  idle_timeout: 20,
})

export default sql

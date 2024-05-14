const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const initializationDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is Running at http://localhost:3000')
    })
  } catch (e) {
    console.log(`DB Error ${e.message}`)
  }
}

initializationDbAndServer()

// const authenticationToken = (request, response, next) => {
//   let jwtToken1
//   const authHeader = request.headers['authorization']
//   if (authHeader !== undefined) {
//     jwtToken1 = authHeader.split(' ')[1]
//   }
//   if (jwtToken1 === undefined) {
//     response.status(401)
//     response.send('Invalid JWT Token')
//   } else {
//     jwt.verify(jwtToken1, 'SECRET_TOKEN', async (error, user) => {
//       if (error) {
//         response.status(401);
//         response.send('Invalid Access Token')
//       } else {
//         next()
//       }
//     })
//   }
// }
const authenticationToken = (request, response, next) => {
  let jwtToken1;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken1 = authHeader.split(" ")[1];
  }
  if (jwtToken1 === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken1, "SECRET_TOKEN", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const selectUserQueryResposne = await db.get(selectUserQuery)
  if (selectUserQueryResposne === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatch = await bcrypt.compare(
      password,
      selectUserQueryResposne.password,
    )
    if (isPasswordMatch === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const converObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

app.get('/states/', authenticationToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state ORDER BY state_id;`
  const getStatesQueryResponse = await db.all(getStatesQuery)
  response.send(
    getStatesQueryResponse.map(eachState =>
      converObjectToResponseObject(eachState),
    ),
  )
})

app.get('/states/:stateId/', authenticationToken, async (request, response) => {
  const {stateId} = request.params
  const getStatesQuery = `SELECT * FROM state WHERE state_id = ${stateId};`
  const getStatesQueryResponse = await db.get(getStatesQuery)
  response.send(converObjectToResponseObject(getStatesQueryResponse))
})

app.post('/districts/', authenticationToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const insertQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths) VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`
  const insertQueryResponse = await db.run(insertQuery)
  const districtId = insertQueryResponse.lastID
  //response.send(insertQueryResponse)
  response.send('District Successfully Added')
})

const converObjectToResponseObject1 = dbObject1 => {
  return {
    districtId: dbObject1.district_id,
    districtName: dbObject1.district_name,
    stateId: dbObject1.state_id,
    cases: dbObject1.cases,
    cured: dbObject1.cured,
    active: dbObject1.active,
    deaths: dbObject1.deaths,
  }
}

app.get(
  '/districts/:districtsId/',
  authenticationToken,
  async (request, response) => {
    const {districtsId} = request.params
    const getStatesQuery = `SELECT * FROM district WHERE district_id = ${districtsId};`
    const getStatesQueryResponse = await db.get(getStatesQuery)
    response.send(converObjectToResponseObject1(getStatesQueryResponse))
  },
)

app.delete(
  '/districts/:districtsId/',
  authenticationToken,
  async (request, response) => {
    const {districtsId} = request.params
    const getStatesQuery = `DELETE FROM district WHERE district_id = ${districtsId};`
    const getStatesQueryResponse = await db.get(getStatesQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const insertQuery = `UPDATE district SET district_name = '${districtName}', state_id = ${stateId}, cases = ${cases}, cured = ${cured}, active = ${active}, deaths = ${deaths} WHERE district_id = ${districtId};`
    const insertQueryResponse = await db.run(insertQuery)
    //const districtId = insertQueryResponse.lastID
    //response.send(insertQueryResponse)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats',
  authenticationToken,
  async (request, response) => {
    const {stateId} = request.params
    const statsQuery = `SELECT sum(cases) as totalCases, sum(cured) as totalCured, sum(active) as totalActive, sum(deaths) as totalDeaths FROM district WHERE state_id = ${stateId};`
    const statsQueryResponse = await db.get(statsQuery)
    response.send(statsQueryResponse)
  },
)

module.exports = app

import express from 'express'
import { stat } from 'fs'
import { promisify } from 'util'

const app = express()
const port = 8738
const _dirname = __dirname.replace('\\dist', '')
const statP = promisify(stat)

app.use(express.static(_dirname + '/static'))
app.get('/', ( req, res ) => {
	res.sendFile(_dirname + '/static/index.html')
})

app.get('*', async (req, res) => {
	try {
		await statP(_dirname + '/static' + req.path + '.html')
		res.sendFile(_dirname + '/static' + req.path + '.html')
	} catch {
		res.sendStatus(404)
	}

})
// start the Express server
app.listen(port, () => {
	console.log( `server started at http://localhost:${ port }` )
})

import express from 'express'
const app = express() 
const port = 8738
const _dirname = __dirname.replace('\\dist', '')

app.use(express.static(_dirname + '/static'))
app.get('/', ( req, res ) => {
	res.sendFile(_dirname + '/static/index.html')
})
// start the Express server
app.listen(port, () => {
	console.log( `server started at http://localhost:${ port }` )
})

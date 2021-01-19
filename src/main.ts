import express from 'express'
import fs from 'fs'
import {promisify} from 'util'
import {extname} from 'path'
import moment from 'moment'
import formidable from 'express-formidable'
import { RateLimiterMemory } from 'rate-limiter-flexible'
// import bodyParser from 'body-parser'

const app = express()
const port = 8738
const _dirname = __dirname.replace(/[\\/]dist/, '')
const stat = promisify(fs.stat)
const readDir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)
const delFile = promisify(fs.unlink)
const renameFile = promisify(fs.rename)
const formParse = () => formidable({
	uploadDir: _dirname + '/files',
	keepExtensions: true
})
// const bodyParse = () => bodyParser.urlencoded({
// 	extended: true
// })
const randID = () => {
	const chars = [...'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890']
	let str = ''
	for (let i = 0;i<10;i++) {
		str += chars[Math.floor(Math.random() * chars.length)]
	}
	return str
}
interface apiResponse {
	success: boolean,
	reason?: string,
	url?: string
}
const handleUpload = async (req): Promise<{ res: apiResponse, code: number }> => {
	const file = req.files.file as File
	if (!file || !req.fields.key) {
		await delFile(file.path)
		return {
			res: {
				success: false,
				reason:	'File or key not given'
			},
			code: 422
		}
	}
	const users = JSON.parse((await readFile(_dirname + '/allowed-users.json')).toString())
	if (!users[req.fields.key]) {
		await delFile(file.path)
		return {
			res: {
				success: false,
				reason: 'Invalid key'
			},
			code: 403
		}
	}
	const id = randID()
	const newName = id + extname(file.path)
	const newPath = _dirname + '/files/' + newName
	await renameFile(file.path, newPath)
	return {
		res: {
			success: true,
			url: `${req.protocol}://${req.get('host')}/${newName}`
		},
		code: 200
	}
}

interface File {
	size: number;
	path: string;
	name: string;
	type: string;
	lastModifiedDate?: Date;
	hash?: string;

	toJSON(): Record<string, unknown>;
}

// Two requests per second allowed
const rateLimiter = new RateLimiterMemory({
	points: 2,
	duration: 60
})

app.use(express.static(_dirname + '/static'))
app.use(express.static(_dirname + '/files'))
const rateLimit = async (req, res, next) => {
	rateLimiter.consume(req.fields.key, 1)
		.then((rateLimiterRes) => {
			next()
		})
		.catch((rateLimiterRes) => {
			res.set({
				'Retry-After': rateLimiterRes.msBeforeNext / 1000,
				'X-RateLimit-Limit': 2,
				'X-RateLimit-Remaining': rateLimiterRes.remainingPoints,
				'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext)
			})
			res.sendStatus(429)
		})
}

app.get('/', ( req, res ) => {
	res.sendFile(_dirname + '/static/index.html')
})

app.post('/uploadfile', formParse(), async (req, res) => {
	const handled = await handleUpload(req)
	res.status(handled.code).json(handled.res)
})

app.get('*', async (req, res) => {
	try {
		await stat(_dirname + '/static' + req.path + '.html')
		res.sendFile(_dirname + '/static' + req.path + '.html')
	} catch {
		res.sendStatus(404)
	}
})

const checkFiles = async () => {
	const files: string[] = await readDir(_dirname + '/files')
	const statFiles = await Promise.all(files.map(f => stat(_dirname + '/files/' + f)))
	const fileObj = Object.fromEntries(files.map((_, i) => [files[i], statFiles[i]]))
	for (const file of Object.keys(fileObj)) {
		const mtime = moment(fileObj[file].mtime)
		if (moment.duration(mtime.diff(moment.now())).asMonths() >= 1) {
			await delFile(_dirname + '/files/' + file)
		}
	}
}
// start the Express server
app.listen(port, async () => {
	console.log(`Server started on port ${port}`)
	await checkFiles()
	setInterval(checkFiles, 60000)
})

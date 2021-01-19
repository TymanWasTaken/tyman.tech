import express from 'express'
import fs from 'fs'
import {promisify} from 'util'
import {extname} from 'path'
import moment from 'moment'
import formidable from 'express-formidable'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import session from 'express-session'
import { v5 as uuidV5, v4 as uuidV4 } from 'uuid'
import ejs from 'ejs'
import glob from 'glob'

const app = express()
app.set('view engine', 'ejs')
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
interface allowedUsers {
	'upload': {
		[s: string]: string
	},
	'admin': {
		[s: string]: string
	}
}
const adminLocked = (req, res, next) => {
	if (req.session['admin']) {
		next()
	} else {
		res.sendStatus(403)
	}
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
	const users: allowedUsers = JSON.parse((await readFile(_dirname + '/allowed-users.json')).toString())
	if (!users.upload[req.fields.key]) {
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

app.use(session({
	secret: uuidV5(uuidV4(), uuidV4()),
	genid: () => uuidV5(uuidV4(), uuidV4()),
	resave: false,
	saveUninitialized: false
}))
app.use(express.static(_dirname + '/static'))
app.use(express.static(_dirname + '/files'))
const rateLimit = async (req, res, next) => {
	rateLimiter.consume(req.fields.key, 1)
		.then(() => {
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
			const file = req.files.file as File
			delFile(file.path)
		})
}

app.get('/', ( req, res ) => {
	res.sendFile(_dirname + '/static/index.html')
})

app.post('/uploadfile', formParse(), rateLimit, async (req, res) => {
	const handled = await handleUpload(req)
	res.status(handled.code).json(handled.res)
})

app.post('/login', formParse(), async (req, res) => {
	const users: allowedUsers = JSON.parse((await readFile(_dirname + '/allowed-users.json')).toString())
	if (users.admin[req.fields.key as string] === (req.fields.user as string)) {
		req.session['admin'] = true
		res.redirect(`${req.protocol}://${req.get('host')}/admin`)
	} else {
		req.session['admin'] = false
		res.sendStatus(403)
	}
})

app.get('/admin', adminLocked, async (req, res) => {
	const files: string[] = await readDir(_dirname + '/files')
	res.render('admin', { files })
})

app.delete('/admin/files', adminLocked, formParse(), async (req, res) => {
	try {
		await delFile(_dirname + '/files/' + req.fields['file'])
		res.sendStatus(200)
	} catch (e) {
		res.sendStatus(500)
		console.log(e.stack)
	}
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

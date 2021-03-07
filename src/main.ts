import express from 'express'
import session from 'express-session'
import { v4 as uuidV4, v5 as uuidV5 } from 'uuid'
import {
	_dirname,
	allowedUsers,
	delFile,
	formParse,
	handleUpload,
	readFile,
	adminLocked,
	rateLimitUploader,
	checkFiles,
	exists,
	readDir,
	stat,
	rateLimitFiles,
} from './utilities'
import { botToken, dev } from './config'
import got from 'got'
import { APIMessage } from 'discord-api-types'

process.on('unhandledRejection', (up) => {
	throw up
})

const app = express()
const port = 8738

app.set('view engine', 'ejs')
if (dev) {
	app.set('trust proxy', false)
	app.use(
		session({
			secret: uuidV5(uuidV4(), uuidV4()),
			genid: () => uuidV5(uuidV4(), uuidV4()),
			resave: false,
			saveUninitialized: false,
			cookie: {
				secure: false,
				httpOnly: false,
			},
		})
	)
} else {
	app.set('trust proxy', true)
	app.use(
		session({
			secret: uuidV5(uuidV4(), uuidV4()),
			genid: () => uuidV5(uuidV4(), uuidV4()),
			resave: false,
			saveUninitialized: false,
			cookie: {
				secure: true,
			},
		})
	)
}
app.use(express.static(_dirname + '/static'))
app.use(express.static(_dirname + '/files'))

app.get('/', (req, res) => {
	res.render('index')
})

app.post('/uploadfile', formParse(), rateLimitUploader, async (req, res) => {
	const handled = await handleUpload(req)
	res.status(handled.code).json(handled.res)
})

app.post('/login', formParse(), async (req, res) => {
	const users: allowedUsers = JSON.parse(
		(await readFile(_dirname + '/allowed-users.json')).toString()
	)
	if (users.admin[req.fields.key as string] === (req.fields.user as string)) {
		req.session['admin'] = true
		res.redirect(`${req.protocol}://${req.get('host')}/admin`)
	} else {
		req.session['admin'] = false
		res.sendStatus(403)
	}
})

app.get('/admin', adminLocked, async (req, res) => {
	await res.render('admin/index')
})

app.get('/admin/files', adminLocked, async (req, res) => {
	const fileNames = await readDir(_dirname + '/files')
	const fileStatPromises = fileNames.map(async (name) => {
		return {
			name,
			time: (await stat(_dirname + '/files/' + name)).mtime.getTime(),
		}
	})
	let fileStats = await Promise.all(fileStatPromises)
	fileStats = fileStats.sort((a, b) => a.time - b.time)
	const files = fileStats.map((f) => f.name)
	await res.render('admin/files', {
		files,
	})
})

app.get('/admin/users', adminLocked, async (req, res) => {
	const users: allowedUsers = JSON.parse(
		(await readFile(_dirname + '/allowed-users.json')).toString()
	)
	await res.render('admin/users', {
		users,
	})
})

app.get('/admin/*', adminLocked, async (req, res) => {
	const path: string = req.path.replace(/^\//, '')
	if (await exists(app.get('views') + '/' + path + '.ejs')) {
		res.render(path)
	} else {
		res.sendStatus(404)
	}
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

app.get('/api/modfiles', rateLimitFiles, async (req, res) => {
	try {
		const apiRes = (await got
			.get(
				'https://discord.com/api/v8/channels/817563414615293973/messages?limit=100',
				{
					headers: {
						Authorization: 'Bot ' + botToken,
					},
				}
			)
			.json()) as APIMessage[]
		res.json({
			success: true,
			files: apiRes.map((m) => {
				const parsed = JSON.parse(m.content)
				return { ...parsed, url: m.attachments[0].proxy_url }
			}),
		})
	} catch (e) {
		res.status(500).json({
			success: false,
			reason:
				'Discord api error: ' +
				(e.response !== undefined
					? JSON.parse(e.response.body).message
					: 'unable to find'),
		})
	}
})

app.get('*', async (req, res) => {
	const path: string = req.path.replace(/^\//, '')
	if (await exists(app.get('views') + '/' + path + '.ejs')) {
		res.render(path)
	} else {
		res.sendStatus(404)
	}
})

// start the Express server
app.listen(port, async () => {
	console.log(`Server started on port ${port}`)
	await checkFiles()
	setInterval(checkFiles, 60000)
})

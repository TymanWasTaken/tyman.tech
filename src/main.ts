import express from 'express';
import session from 'express-session';
import { v4 as uuidV4, v5 as uuidV5 } from 'uuid';
import sass from 'sass';
import { _dirname, checkFiles, exists } from './utilities';
import { dev } from './config';
import { join, parse } from 'path';
import { readdirSync, writeFileSync } from 'fs';
import * as routers from './routers';
import cors from 'cors';

process.on('unhandledRejection', up => {
	throw up;
});

// Render all scss
const scssFileNames = readdirSync(join(__dirname, '..', 'static', 'scss'));

for (const sccsFileName of scssFileNames) {
	const rendered = sass.renderSync({
		file: join(__dirname, '..', 'static', 'scss', sccsFileName),
		outputStyle: dev ? 'expanded' : 'compressed'
	});
	writeFileSync(
		join(
			__dirname,
			'..',
			'static',
			'css',
			parse(sccsFileName).name + '.css'
		),
		rendered.css
	);
}

const app = express();
const port = 8738;

// Set view engine
app.set('view engine', 'ejs');

// Remove the blatant express.js advertising that is also a vulnerability
app.disable('x-powered-by');
if (dev) {
	// Set settings for dev, no https and no proxy
	app.set('trust proxy', false);
	app.use(
		session({
			secret: uuidV5(uuidV4(), uuidV4()),
			genid: () => uuidV5(uuidV4(), uuidV4()),
			resave: false,
			saveUninitialized: false,
			cookie: {
				secure: false,
				httpOnly: false
			}
		})
	);
} else {
	// Set settings for production, https and proxy
	app.set('trust proxy', true);
	app.use(
		session({
			secret: uuidV5(uuidV4(), uuidV4()),
			genid: () => uuidV5(uuidV4(), uuidV4()),
			resave: false,
			saveUninitialized: false,
			cookie: {
				secure: true
			}
		})
	);
}

// Set up CORS
app.use(cors());

// Static dirs
app.use(express.static(_dirname + '/static'));
app.use(express.static(_dirname + '/files'));

// Routers from ./routers
app.use('/', routers.IndexRouter);
app.use('/api', routers.APIRouter);
app.use('/admin', routers.AdminRouter);

// Handle static views or 404 last
app.get('*', async (req, res) => {
	const path: string = req.path.replace(/^\//, '');
	if (await exists(app.get('views') + '/' + path + '.ejs')) {
		res.render(path);
	} else {
		res.sendStatus(404);
	}
});

// start the Express server
app.listen(port, async () => {
	console.log(`Server started on port ${port}`);
	await checkFiles();
	setInterval(checkFiles, 60000);
});

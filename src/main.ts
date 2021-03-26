import express, { Express } from 'express';
import session from 'express-session';
import { v4 as uuidV4, v5 as uuidV5 } from 'uuid';
import { _dirname, checkFiles, exists, renderSCSSPromise } from './utilities';
import { dev, db as dbConfig } from './config';
import { join, parse } from 'path';
import { promises as fsPromises } from 'fs';
import * as routers from './routers';
import cors from 'cors';
import { DataTypes, Sequelize } from 'sequelize';
import * as Models from './models';

process.on('unhandledRejection', up => {
	throw up;
});

class TymanTech {
	public express: Express;
	public port = 8738;
	public db: Sequelize;
	public constructor() {		
		this.express = express();		
		this.db = new Sequelize('tyman-tech-api', dbConfig.username, dbConfig.password, {
			host: dbConfig.host,
			port: dbConfig.port,
			dialect: 'postgres',
			logging: false
		})	
	}
	public async init(): Promise<void> {
		if (!dev) {
			// Render all scss if in production
			const scssFileNames = await fsPromises.readdir(join(__dirname, '..', 'static', 'scss'));
		
			for (const sccsFileName of scssFileNames) {
				const rendered = await renderSCSSPromise({
					file: join(__dirname, '..', 'static', 'scss', sccsFileName),
					outputStyle: 'compressed'
				});
				await fsPromises.writeFile(
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
		}
		let expressSession: express.RequestHandler;
		let cssHandler: express.RequestHandler;
		// Set view engine
		this.express.set('view engine', 'ejs');
		
		// Remove the blatant express.js advertising that is also a vulnerability
		this.express.disable('x-powered-by');
		if (dev) {
			// Set settings for dev, no https and no proxy
			this.express.set('trust proxy', false);
			expressSession = session({
				secret: uuidV5(uuidV4(), uuidV4()),
				genid: () => uuidV5(uuidV4(), uuidV4()),
				resave: false,
				saveUninitialized: false,
				cookie: {
					secure: false,
					httpOnly: false
				}
			});
			cssHandler = async (req, res, next) => {
				const path = parse(req.path);
				if (path.ext !== '.css' && path.dir !== '/css') {
					next();
					return;
				}
				const cssName = path.name;
				const scssFiles = await fsPromises.readdir(
					join(__dirname, '..', 'static', 'scss')
				);
				if (scssFiles.includes(cssName + '.scss')) {
					const compiled = await renderSCSSPromise({
						file: join(
							__dirname,
							'..',
							'static',
							'scss',
							cssName + '.scss'
						),
						outFile: 'expanded'
					});
					res.status(200).type('css').send(compiled.css);
				} else {
					next();
				}
			};
		} else {
			// Set settings for production, https and proxy
			this.express.set('trust proxy', true);
			expressSession = session({
				secret: uuidV5(uuidV4(), uuidV4()),
				genid: () => uuidV5(uuidV4(), uuidV4()),
				resave: false,
				saveUninitialized: false,
				cookie: {
					secure: true
				}
			});
		}

		// Auth DB
		await this.db.authenticate();

		// Set up DB
		await this.dbInit();
		
		// Set up CORS
		this.express.use(cors());
		
		// Set up express-session
		this.express.use(expressSession);
		
		// Add (s)css handler if exists
		if (cssHandler) this.express.use(cssHandler);
		
		// Static dirs
		this.express.use(express.static(_dirname + '/static'));
		this.express.use(express.static(_dirname + '/files'));
		
		// Routers from ./routers
		this.express.use('/', routers.IndexRouter);
		this.express.use('/api', routers.APIRouter);
		this.express.use('/admin', routers.AdminRouter);
		
		// Handle static views or 404 last
		this.express.get('*', async (req, res) => {
			const path: string = req.path.replace(/^\//, '');
			if (await exists(this.express.get('views') + '/' + path + '.ejs')) {
				res.render(path);
			} else {
				res.sendStatus(404);
			}
		});
	}
	public async dbInit(): Promise<void> {
		Models.MinecraftAccountLink.init(
			{
				discordID: {
					type: DataTypes.STRING,
					allowNull: false,
					primaryKey: true
				},
				minecraftID: {
					type: DataTypes.STRING,
					allowNull: false
				}
			},
			{sequelize: this.db}
		)
		await this.db.sync({alter: true})
	}
	public start(): void {
		// start the Express server
		this.express.listen(this.port, async () => {
			console.log(`Server started on port ${this.port}`);
			await checkFiles();
			setInterval(checkFiles, 60000);
		});	
	}
}

const app = new TymanTech();
app.init().then(() => {
	app.start();
})
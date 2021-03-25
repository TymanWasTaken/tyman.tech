import formidable from 'express-formidable';
import { extname } from 'path';
import { promisify } from 'util';
import * as fs from 'fs';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import moment from 'moment';
import express from 'express';
import sass from 'sass';

export interface File {
	size: number;
	path: string;
	name: string;
	type: string;
	lastModifiedDate?: Date;
	hash?: string;

	toJSON(): Record<string, unknown>;
}

export interface apiResponse {
	success: boolean;
	reason?: string;
	url?: string;
}

export interface allowedUsers {
	keys: {
		username: string;
		key: string;
		scopes: ('upload' | 'admin')[];
	}[];
}

export const _dirname = __dirname.replace(/[\\/]dist/, '');
export const stat = promisify(fs.stat);
export const readDir = promisify(fs.readdir);
export const readFile = promisify(fs.readFile);
// export const writeFile = promisify(fs.writeFile)
export const delFile = promisify(fs.unlink);
export const renameFile = promisify(fs.rename);
export const exists = promisify(fs.exists);

export const formParse = (): express.RequestHandler =>
	formidable({
		uploadDir: _dirname + '/files',
		keepExtensions: true
	});
export const rateLimiterUploader = new RateLimiterMemory({
	points: 2,
	duration: 60
});

export const rateLimiterFiles = new RateLimiterMemory({
	points: 2,
	duration: 10
});

export const rateLimitUploader = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
): Promise<void> => {
	rateLimiterUploader
		.consume(req.fields.key as string, 1)
		.then(() => {
			next();
		})
		.catch(rateLimiterRes => {
			res.set({
				'Retry-After': rateLimiterRes.msBeforeNext / 1000,
				'X-RateLimit-Limit': 2,
				'X-RateLimit-Remaining': rateLimiterRes.remainingPoints,
				'X-RateLimit-Reset': new Date(
					Date.now() + rateLimiterRes.msBeforeNext
				)
			});
			res.sendStatus(429);
			const file = req.files.file as File;
			delFile(file.path);
		});
};

export const rateLimitFiles = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
): Promise<void> => {
	rateLimiterFiles
		.consume(req.sessionID, 1)
		.then(() => {
			next();
		})
		.catch(rateLimiterRes => {
			res.set({
				'Retry-After': rateLimiterRes.msBeforeNext / 1000,
				'X-RateLimit-Limit': 2,
				'X-RateLimit-Remaining': rateLimiterRes.remainingPoints,
				'X-RateLimit-Reset': new Date(
					Date.now() + rateLimiterRes.msBeforeNext
				)
			});
			res.sendStatus(429);
			const file = req.files.file as File;
			delFile(file.path);
		});
};

export const handleUpload = async (
	req: express.Request
): Promise<{ res: apiResponse; code: number }> => {
	const file = req.files.file as File;
	if (!file) {
		await delFile(file.path);
		return {
			res: {
				success: false,
				reason: 'File not given'
			},
			code: 422
		};
	}
	const id = randID();
	const newName = id + extname(file.path);
	const newPath = _dirname + '/files/' + newName;
	await renameFile(file.path, newPath);
	return {
		res: {
			success: true,
			url: `${req.protocol}://${req.get('host')}/${newName}`
		},
		code: 200
	};
};

export const randID = (): string => {
	const chars = [
		...'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890'
	];
	let str = '';
	for (let i = 0; i < 10; i++) {
		str += chars[Math.floor(Math.random() * chars.length)];
	}
	return str;
};

export const adminLocked = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
): void => {
	if (req.session['admin']) {
		next();
	} else {
		res.sendStatus(403);
	}
};

export const apiKeyLocked = (type: 'upload' | 'admin') => {
	return async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	): Promise<void> => {
		const users: allowedUsers = JSON.parse(
			(await readFile(_dirname + '/allowed-users.json')).toString()
		);
		if (
			!users.keys.some(
				u =>
					u.key === req.headers.authorization &&
					u.scopes.includes(type)
			)
		) {
			res.status(403).json({
				success: false,
				reason: 'Invalid key'
			});
		} else {
			next();
		}
	};
};

export const checkFiles = async (): Promise<void> => {
	const files: string[] = await readDir(_dirname + '/files');
	const statFiles = await Promise.all(
		files.map(f => stat(_dirname + '/files/' + f))
	);
	const fileObj = Object.fromEntries(
		files.map((_, i) => [files[i], statFiles[i]])
	);
	for (const file of Object.keys(fileObj)) {
		const mtime = moment(fileObj[file].mtime);
		if (moment.duration(mtime.diff(moment.now())).asMonths() >= 1) {
			await delFile(_dirname + '/files/' + file);
		}
	}
};

// export class JsonDB {
// 	public path: string
// 	constructor(file: string) {
// 		const path = this.path = _dirname + '/' + file
// 		if (fs.existsSync(path)) {
// 			this.path = path
// 		} else {
// 			throw new Error('Specified db is not a file!')
// 		}
// 	}
// 	private getFileContents = async () => {
// 		return (await readFile(this.path)).toString()
// 	}
// 	private setFileContents = async (contents: string) => {
// 		return (await writeFile(this.path, contents))
// 	}
// 	// eslint-disable-next-line @typescript-eslint/no-explicit-any
// 	public getContent = async (): Promise<Record<string, any>> => {
// 		return JSON.parse(await this.getFileContents())
// 	}
//
// 	// eslint-disable-next-line @typescript-eslint/no-explicit-any
// 	public setContent = async (data: Record<string, any>): Promise<void> => {
// 		return JSON.stringify(await this.setFileContents(data))
// 	}
// }

export const renderSCSSPromise = (
	options: sass.Options
): Promise<sass.Result> => {
	return new Promise((resolve, reject) => {
		sass.render(options, (e, result) => {
			if (e) {
				reject(e);
			} else {
				resolve(result);
			}
		});
	});
};

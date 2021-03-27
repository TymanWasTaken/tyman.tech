import { APIUser } from 'discord-api-types';
import got from 'got';
import { botToken } from '../config';
import { BaseModel } from './BaseModel';

export interface LinkAccountModel {
	id: string;
	discordID: string;
	minecraftID: string;
}

export class LinkAccount
	extends BaseModel<LinkAccountModel, Partial<LinkAccountModel>>
	implements LinkAccountModel {
	public readonly id: string;
	public discordID: string;
	public minecraftID: string;
	public async getDiscordTag(): Promise<string> {
		const discordRes = (await got
			.get(`https://discord.com/api/v8/users/${this.discordID}`, {
				headers: {
					Authorization: botToken
				}
			})
			.json()) as APIUser;
		return `${discordRes.username}#${discordRes.discriminator}`;
	}
	public async getMinecraftUsername(): Promise<string> {
		const mcRes = (await got
			.get(`https://api.ashcon.app/mojang/v2/user/${this.minecraftID}`)
			.json()) as {
			uuid: string;
			username: string;
		};
		return mcRes.username;
	}
	public toJSON(): {
		discordID: string;
		minecraftID: string;
		id: string;
	} {
		return {
			discordID: this.discordID,
			minecraftID: this.minecraftID,
			id: this.id
		};
	}
}

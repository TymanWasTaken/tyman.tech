import { Router } from 'express';
import { LinkAccount } from '../../models';

const router = Router();

router.get('/platform/discord/:id', async (req, res) => {
	const entry = await LinkAccount.findOne({
		where: {
			discordID: req.params.id
		}
	});
	if (!entry) {
		res.status(404).json({
			success: false,
			reason: 'Link not found'
		});
	} else {
		res.status(200).json({
			success: true,
			user: entry.toJSON()
		});
	}
});

router.get('/platform/minecraft/:id', async (req, res) => {
	const entry = await LinkAccount.findOne({
		where: {
			minecraftID: req.params.id
		}
	});
	if (!entry) {
		res.status(404).json({
			success: false,
			reason: 'Link not found'
		});
	} else {
		res.status(200).json({
			success: true,
			user: entry.toJSON()
		});
	}
});

export const APILinksRouter = router;

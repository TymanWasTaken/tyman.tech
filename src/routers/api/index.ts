// Import subrouters
import { APIFilesRouter } from './files';
import { APILinksRouter } from './links';

// Init main api router
import { Router } from 'express';

const router = Router();

// Add api subrouters
router.use('/files', APIFilesRouter);
router.use('/links', APILinksRouter);

router.get('/', (req, res) => {
	res.render('api/index');
});

export const APIRouter = router;

// Export all other routers
export * from './api';
export * from './admin';

// Export actual index router
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
	res.render('index');
});

export const IndexRouter = router;

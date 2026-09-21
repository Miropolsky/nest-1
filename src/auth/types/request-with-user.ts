import { Request } from 'express';
import type { JwtPayload } from '../constants.js';

export type RequestWithUser = Request & { user?: JwtPayload };

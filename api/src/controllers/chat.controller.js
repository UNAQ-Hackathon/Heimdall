import mongoose from 'mongoose';
import Investigation from '../models/Investigation.js';
import { answerQuestion, getDevinSessionStatus } from '../services/devin.service.js';

export async function ask(req, res) {
  const { question, sessionId } = req.body;

  let contextDocs = [];
  if (mongoose.connection.readyState === 1) {
    try {
      contextDocs = await Investigation.find(
        { $text: { $search: question } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(5)
        .lean();
    } catch {
      contextDocs = [];
    }
  }

  const result = await answerQuestion(question, contextDocs, { sessionId });
  res.json({ question, ...result });
}

export async function pollSession(req, res) {
  const { sessionId } = req.params;
  const baselineCount = Number(req.query.baselineCount ?? 0);

  const info = await getDevinSessionStatus(sessionId);
  const hasNewReply = info.devinMessageCount > baselineCount && Boolean(info.latestReply);

  res.json({
    sessionId: info.sessionId,
    sessionUrl: info.sessionUrl,
    sessionStatus: info.sessionStatus,
    status: hasNewReply ? 'completed' : 'pending',
    answer: hasNewReply ? info.latestReply : null,
    devinMessageCount: info.devinMessageCount,
  });
}

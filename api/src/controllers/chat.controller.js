import mongoose from 'mongoose';
import Investigation from '../models/Investigation.js';
import {
  answerQuestion,
  extractCitations,
  getDevinSessionStatus,
  PSI_FALLBACK_DOCS,
} from '../services/devin.service.js';

export async function ask(req, res) {
  const { question, sessionId, audience, scenario } = req.body;

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

  const result = await answerQuestion(question, contextDocs, {
    sessionId,
    audience,
    scenario,
  });
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
    devinMode: info.devinMode,
    status: hasNewReply ? 'completed' : 'pending',
    answer: hasNewReply ? info.latestReply : null,
    citations: hasNewReply ? extractCitations(PSI_FALLBACK_DOCS, info.latestReply) : [],
    devinMessageCount: info.devinMessageCount,
  });
}

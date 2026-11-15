import mongoose from 'mongoose';
import Investigation from '../models/Investigation.js';
import {
  answerQuestion,
  extractCitations,
  getDevinAccountStatus,
  getDevinSessionStatus,
  PSI_FALLBACK_DOCS,
} from '../services/devin.service.js';
import { getReadOnlyMongoContext } from '../services/mongo-reader.service.js';

export async function status(_req, res) {
  const info = await getDevinAccountStatus();
  res.json(info);
}

export async function ask(req, res) {
  const { question, sessionId, audience, scenario } = req.body;
  const wantsStream =
    req.body?.stream === true ||
    String(req.get('accept') ?? '').includes('text/event-stream');

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

  const mongoContext = await getReadOnlyMongoContext(question).catch(() => null);

  if (wantsStream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      const result = await answerQuestion(question, contextDocs, {
        sessionId,
        audience,
        scenario,
        mongoContext,
        onEvent: (evt) => send(evt.type, evt),
      });
      send('answer', { question, ...result });
    } catch (err) {
      send('error', { message: err.message, status: err.status ?? 500 });
    }
    res.end();
    return;
  }

  const result = await answerQuestion(question, contextDocs, {
    sessionId,
    audience,
    scenario,
    mongoContext,
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

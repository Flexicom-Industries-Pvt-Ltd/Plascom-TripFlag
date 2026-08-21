import { getDb } from './db';
import { NextResponse } from 'next/server';

/**
 * Higher-order function to wrap API route handlers with logging functionality.
 * Logs method, URL, headers, payload, response status, and response time.
 * Also automatically cleans up logs older than 30 days (1% probability to save compute).
 */
export function withLogging(handler) {
  return async (req, context) => {
    const startTime = Date.now();
    const method = req.method;
    const url = req.url;

    // Parse request headers
    const requestHeaders = {};
    req.headers.forEach((value, key) => {
      requestHeaders[key] = value;
    });

    // Attempt to clone and parse request body (payload) safely
    let requestBody = null;
    let reqClone = req.clone();
    
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const textBody = await reqClone.text();
        if (textBody) {
          try {
            requestBody = JSON.parse(textBody);
          } catch (e) {
            requestBody = textBody; // Fallback to raw text if not JSON
          }
        }
      }
    } catch (err) {
      console.warn("Could not parse request body for logging:", err);
    }

    let response;
    let responseStatus = 500;
    let responseBody = null;

    try {
      // Execute the original handler
      response = await handler(req, context);
      responseStatus = response.status;
      
      // Attempt to clone and parse response body safely
      try {
        const resClone = response.clone();
        const resText = await resClone.text();
        if (resText) {
          try {
            responseBody = JSON.parse(resText);
          } catch (e) {
            responseBody = resText;
          }
        }
      } catch (e) {
        console.warn("Could not parse response body for logging.");
      }

      return response;
    } catch (error) {
      // Log errors
      responseStatus = 500;
      responseBody = { error: error.message || 'Internal Server Error' };
      throw error;
    } finally {
      const responseTimeMs = Date.now() - startTime;
      
      // Asynchronously log to the database without awaiting (fire and forget)
      // This prevents the API from slowing down.
      logToDatabase({
        method,
        url,
        requestHeaders,
        requestBody,
        responseStatus,
        responseTimeMs,
        responseBody
      }).catch(err => {
        console.error("Failed to write to api_logs:", err);
      });
    }
  };
}

async function logToDatabase(logData) {
  const sql = getDb();
  
  await sql`
    INSERT INTO api_logs (
      method, url, request_headers, request_body, response_status, response_time_ms, response_body
    ) VALUES (
      ${logData.method},
      ${logData.url},
      ${JSON.stringify(logData.requestHeaders)},
      ${logData.requestBody ? JSON.stringify(logData.requestBody) : null},
      ${logData.responseStatus},
      ${logData.responseTimeMs},
      ${logData.responseBody ? JSON.stringify(logData.responseBody) : null}
    )
  `;

  // Probabilistic cleanup: 1% chance to run cleanup of old logs to save compute
  if (Math.random() < 0.01) {
    try {
      await sql`DELETE FROM api_logs WHERE created_at < NOW() - INTERVAL '30 days'`;
    } catch (cleanupError) {
      console.error("Log cleanup error:", cleanupError);
    }
  }
}

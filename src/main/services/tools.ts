import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import type { SofiiDb } from './db'
import { scheduleReminder } from './scheduler'
import { fireReminder } from './reminderFiring'
import { getWeather } from './weather'

export const TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_reminder',
      description:
        'Create a reminder for the user at a specific date and time. Use this whenever the user asks to be reminded, notified, or nudged about something at a future time.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'What to remind the user about.' },
          scheduled_at_iso: {
            type: 'string',
            description:
              'ISO 8601 datetime (with timezone offset) when the reminder should fire. Resolve relative times like "in 10 minutes" or "tomorrow at 5pm" using the current date/time given in the system prompt.'
          }
        },
        required: ['content', 'scheduled_at_iso']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_memory',
      description:
        'Save a durable fact about the user for recall in future conversations. Use this only when the user explicitly asks you to remember something.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The fact to remember, written as a short standalone statement.'
          }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_reminders',
      description:
        "List the user's upcoming (pending) reminders. Use this when the user asks what reminders they have or what's coming up.",
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description:
        "Get the current weather and a 3-day forecast for a location. Use this whenever the user asks about weather, temperature, or whether it will rain/snow somewhere. If you don't know the user's location, ask them or check if they've told you before.",
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'A city name (and optionally country), e.g. "Delhi" or "Paris, France".'
          }
        },
        required: ['location']
      }
    }
  }
]

export interface ToolCallRequest {
  name: string
  argumentsJson: string
}

/**
 * Executes one tool call and returns the plain-text result to feed back to
 * the model as the tool response message. Never throws — invalid input, a
 * network/API failure (get_weather), or an unknown tool name all become an
 * error string the model can react to instead of crashing the conversation
 * turn.
 */
export async function executeToolCall(request: ToolCallRequest, db: SofiiDb): Promise<string> {
  let args: Record<string, unknown>

  try {
    args = request.argumentsJson ? JSON.parse(request.argumentsJson) : {}
  } catch {
    return `Error: could not parse arguments for "${request.name}" as JSON.`
  }

  switch (request.name) {
    case 'create_reminder': {
      const content = typeof args.content === 'string' ? args.content.trim() : ''
      const scheduledAtIso = typeof args.scheduled_at_iso === 'string' ? args.scheduled_at_iso : ''

      if (!content) return 'Error: content is required.'

      const scheduledAt = Date.parse(scheduledAtIso)
      if (Number.isNaN(scheduledAt)) {
        return `Error: could not parse "${scheduledAtIso}" as a date.`
      }

      const reminder = db.createReminder(content, scheduledAt)
      scheduleReminder(reminder, fireReminder)
      return `Reminder created: "${content}" at ${new Date(scheduledAt).toLocaleString()}.`
    }

    case 'create_memory': {
      const content = typeof args.content === 'string' ? args.content.trim() : ''
      if (!content) return 'Error: content is required.'

      db.createMemory(content)
      return `Memory saved: "${content}".`
    }

    case 'list_reminders': {
      const pending = db.listPendingReminders()
      if (pending.length === 0) return 'No upcoming reminders.'

      return pending
        .map((r) => `- "${r.content}" at ${new Date(r.scheduled_at).toLocaleString()}`)
        .join('\n')
    }

    case 'get_weather': {
      const location = typeof args.location === 'string' ? args.location.trim() : ''
      if (!location) return 'Error: location is required.'

      try {
        return await getWeather(location)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return `Error fetching weather: ${message}`
      }
    }

    default:
      return `Error: unknown tool "${request.name}".`
  }
}

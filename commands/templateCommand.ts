import { FileText } from 'lucide-react'
import { ChatCommand } from '../types/chatCommands'
import { format } from 'date-fns'

const templates = {
  meeting: `# Meeting Notes - {date}

## Attendees
-

## Agenda
-

## Discussion
-

## Action Items
- [ ]

## Next Steps
- `,

  journal: `# Journal Entry - {date}

## Morning Reflection


## Goals for Today
- [ ]
- [ ]
- [ ]

## Evening Review


## Gratitude
- `,

  'project-plan': `# Project: {title}

## Overview


## Goals
- [ ]
- [ ]

## Timeline


## Resources
-

## Tasks
- [ ]
- [ ]

## Notes
- `,

  'weekly-review': `# Weekly Review - Week of {date}

## Accomplishments
-

## Challenges
-

## Learnings
-

## Goals for Next Week
- [ ]
- [ ]

## Notes
- `,

  bug: `# Bug Report - {date}

## Description


## Steps to Reproduce
1.
2.
3.

## Expected Behavior


## Actual Behavior


## Environment
-

## Additional Notes
- `,
}

export const templateCommand: ChatCommand = {
  name: 'template',
  aliases: ['tpl', 'tmpl'],
  description: 'Insert a note template',
  usage: '/template <template-name> [title]',
  category: 'note',
  icon: FileText,
  arguments: [
    {
      name: 'template',
      description: 'Template name (meeting, journal, project-plan, weekly-review, bug)',
      required: true,
    },
    {
      name: 'title',
      description: 'Optional title for the template',
      required: false,
    },
  ],

  validate: (args) => {
    if (args.length === 0) {
      return {
        valid: false,
        error: `Please specify a template. Available: ${Object.keys(templates).join(', ')}`,
      }
    }

    const templateName = args[0].toLowerCase()
    if (!templates[templateName as keyof typeof templates]) {
      return {
        valid: false,
        error: `Unknown template "${templateName}". Available: ${Object.keys(templates).join(', ')}`,
      }
    }

    return { valid: true }
  },

  execute: async (args) => {
    const templateName = args[0].toLowerCase() as keyof typeof templates
    const title = args.slice(1).join(' ') || 'Untitled'

    let content = templates[templateName]
    content = content.replace(/{date}/g, format(new Date(), 'yyyy-MM-dd'))
    content = content.replace(/{title}/g, title)

    return {
      success: true,
      insertContent: content,
      clearInput: false,
      message: `Inserted ${templateName} template`,
    }
  },

  autocomplete: async () => {
    return Object.keys(templates)
  },
}

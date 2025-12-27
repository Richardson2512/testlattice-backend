const fs = require('fs')
const path = require('path')

const docsDir = path.join(__dirname, '../app/docs')
const contentDir = path.join(__dirname, '../content/docs')

// Ensure content directory exists
if (!fs.existsSync(contentDir)) {
  fs.mkdirSync(contentDir, { recursive: true })
}

// Get all page directories
const pageDirs = fs.readdirSync(docsDir)
  .filter(item => {
    const itemPath = path.join(docsDir, item)
    return fs.statSync(itemPath).isDirectory() && item !== 'components'
  })

console.log(`Found ${pageDirs.length} pages to migrate\n`)

pageDirs.forEach(pageDir => {
  const pageFile = path.join(docsDir, pageDir, 'page.tsx')
  const contentFile = path.join(contentDir, `${pageDir}.tsx`)

  if (!fs.existsSync(pageFile)) {
    console.log(`⚠️  Skipping ${pageDir} - no page.tsx found`)
    return
  }

  try {
    const content = fs.readFileSync(pageFile, 'utf8')

    // Extract metadata
    const metadataMatch = content.match(/export const metadata[^}]+}/s)

    // Extract component (everything from export default function to end)
    const componentMatch = content.match(/export default function[\s\S]+/)

    if (!componentMatch) {
      console.log(`⚠️  Skipping ${pageDir} - no component found`)
      return
    }

    // Get component name
    const componentNameMatch = content.match(/export default function (\w+)/)
    const componentName = componentNameMatch ? componentNameMatch[1] : pageDir.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
    const contentComponentName = `${componentName}Content`

    // Create content file - remove metadata import and export
    let componentContent = componentMatch[0]
      .replace(/import type { Metadata } from 'next'\n/g, '')
      .replace(/export const metadata[^}]+}\n\n/g, '')

    // Check if it needs doc component imports
    const needsDocImports = componentContent.includes('<TLDR') ||
      componentContent.includes('<FitCard') ||
      componentContent.includes('<Callout') ||
      componentContent.includes('<Comparison') ||
      componentContent.includes('<Insight')

    if (needsDocImports && !componentContent.includes("from '@/components/docs'")) {
      const imports = []
      if (componentContent.includes('<TLDR')) imports.push('TLDR')
      if (componentContent.includes('<FitCard')) imports.push('FitCard')
      if (componentContent.includes('<Callout')) imports.push('Callout')
      if (componentContent.includes('<Comparison')) imports.push('Comparison', 'ComparisonRow')
      if (componentContent.includes('<Insight')) imports.push('Insight')

      if (imports.length > 0) {
        componentContent = `import { ${imports.join(', ')} } from '@/components/docs'\n\n${componentContent}`
      }
    }

    // Rename component to Content version
    componentContent = componentContent.replace(
      new RegExp(`export default function ${componentName}`),
      `export default function ${contentComponentName}`
    )

    // Write content file
    fs.writeFileSync(contentFile, componentContent, 'utf8')

    // Create route file
    const routeContent = `import type { Metadata } from 'next'
import ${contentComponentName} from '@/content/docs/${pageDir}'

${metadataMatch ? metadataMatch[0] : `export const metadata: Metadata = {
  title: '${pageDir.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} | Rihario Docs',
  description: '',
}`}

export default function ${componentName}() {
  return <${contentComponentName} />
}
`

    fs.writeFileSync(pageFile, routeContent, 'utf8')

    console.log(`✅ Migrated ${pageDir}`)
  } catch (error) {
    console.error(`❌ Error migrating ${pageDir}:`, error.message)
  }
})

console.log(`\n✅ Migration complete!`)


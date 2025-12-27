const fs = require('fs')
const path = require('path')

const docsDir = path.join(__dirname, '../app/docs')
const contentDir = path.join(__dirname, '../content/docs')

// Get all page.tsx files
function getAllPageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory() && file !== 'components') {
      const pageFile = path.join(filePath, 'page.tsx')
      if (fs.existsSync(pageFile)) {
        fileList.push({
          folder: file,
          fullPath: pageFile,
          contentPath: path.join(contentDir, `${file}.tsx`),
          routePath: pageFile
        })
      }
    }
  })

  return fileList
}

const pages = getAllPageFiles(docsDir)

console.log(`Found ${pages.length} documentation pages to migrate`)

pages.forEach(({ folder, fullPath, contentPath, routePath }) => {
  try {
    // Read the original page
    const content = fs.readFileSync(fullPath, 'utf8')

    // Extract metadata and component
    const metadataMatch = content.match(/export const metadata[^}]+}/s)
    const componentMatch = content.match(/export default function[^{]+{[\s\S]+}/)

    if (!componentMatch) {
      console.log(`⚠️  Skipping ${folder} - no component found`)
      return
    }

    // Create content file (component only, no metadata)
    let componentContent = componentMatch[0]

    // Remove metadata import if present
    componentContent = componentContent.replace(/import type { Metadata } from 'next'\n/g, '')

    // Remove metadata export
    componentContent = componentContent.replace(/export const metadata[^}]+}\n\n/g, '')

    // Ensure proper imports for doc components
    if (!componentContent.includes("from '@/components/docs'")) {
      // Check if it uses any doc components
      const usesTLDR = componentContent.includes('<TLDR')
      const usesFitCard = componentContent.includes('<FitCard')
      const usesCallout = componentContent.includes('<Callout')
      const usesComparison = componentContent.includes('<Comparison')
      const usesInsight = componentContent.includes('<Insight')

      if (usesTLDR || usesFitCard || usesCallout || usesComparison || usesInsight) {
        const imports = []
        if (usesTLDR) imports.push('TLDR')
        if (usesFitCard) imports.push('FitCard')
        if (usesCallout) imports.push('Callout')
        if (usesComparison) imports.push('Comparison', 'ComparisonRow')
        if (usesInsight) imports.push('Insight')

        if (imports.length > 0) {
          componentContent = `import { ${imports.join(', ')} } from '@/components/docs'\n\n${componentContent}`
        }
      }
    }

    // Write content file
    fs.writeFileSync(contentPath, componentContent, 'utf8')

    // Create route file (metadata + import)
    const routeContent = `import type { Metadata } from 'next'
import ${folder.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Content from '@/content/docs/${folder}'

${metadataMatch ? metadataMatch[0] : `export const metadata: Metadata = {
  title: '${folder.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} | Rihario Docs',
  description: '',
}`}

export default function ${folder.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}() {
  return <${folder.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Content />
}
`

    fs.writeFileSync(routePath, routeContent, 'utf8')

    console.log(`✅ Migrated ${folder}`)
  } catch (error) {
    console.error(`❌ Error migrating ${folder}:`, error.message)
  }
})

console.log('\n✅ Migration complete!')


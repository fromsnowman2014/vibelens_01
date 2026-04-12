import { useMemo } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import Prism from 'prismjs'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-css'
import type { DiffFile } from '@shared/types'

interface Props {
  file: DiffFile
}

const diffStyles = {
  variables: {
    dark: {
      diffViewerBackground: 'rgb(34, 34, 50)',
      diffViewerColor: 'rgb(205, 214, 244)',
      addedBackground: 'rgba(166, 227, 161, 0.14)',
      addedColor: 'rgb(205, 214, 244)',
      removedBackground: 'rgba(243, 139, 168, 0.14)',
      removedColor: 'rgb(205, 214, 244)',
      wordAddedBackground: 'rgba(166, 227, 161, 0.32)',
      wordRemovedBackground: 'rgba(243, 139, 168, 0.32)',
      addedGutterBackground: 'rgba(166, 227, 161, 0.18)',
      removedGutterBackground: 'rgba(243, 139, 168, 0.18)',
      gutterBackground: 'rgb(30, 30, 46)',
      gutterBackgroundDark: 'rgb(26, 26, 40)',
      highlightBackground: 'rgba(137, 180, 250, 0.08)',
      highlightGutterBackground: 'rgba(137, 180, 250, 0.18)',
      codeFoldGutterBackground: 'rgb(45, 45, 68)',
      codeFoldBackground: 'rgb(38, 38, 55)',
      emptyLineBackground: 'rgb(26, 26, 40)',
      gutterColor: 'rgb(127, 132, 156)',
      addedGutterColor: 'rgb(166, 227, 161)',
      removedGutterColor: 'rgb(243, 139, 168)',
      codeFoldContentColor: 'rgb(166, 173, 200)',
      diffViewerTitleBackground: 'rgb(38, 38, 55)',
      diffViewerTitleColor: 'rgb(205, 214, 244)',
      diffViewerTitleBorderColor: 'rgb(69, 71, 90)'
    }
  },
  line: {
    padding: '2px 8px',
    fontSize: '12px',
    lineHeight: '18px',
    fontFamily:
      '"SF Mono", ui-monospace, Menlo, Monaco, "Cascadia Mono", monospace'
  },
  gutter: {
    minWidth: '3em',
    fontSize: '11px'
  }
}

function highlightSyntax(str: string, language?: string): React.ReactElement {
  if (!language || !Prism.languages[language]) {
    return <span>{str}</span>
  }
  try {
    const html = Prism.highlight(str, Prism.languages[language], language)
    return <span dangerouslySetInnerHTML={{ __html: html }} />
  } catch {
    return <span>{str}</span>
  }
}

export function DiffViewer({ file }: Props) {
  const language = file.language

  const body = useMemo(() => {
    if (file.isBinary) {
      return (
        <div className="p-6 text-center text-fg-secondary text-sm">
          Binary file ·{' '}
          <span className="text-fg-muted">cannot display diff</span>
        </div>
      )
    }
    return (
      <div className="text-[12px]">
        {file.isTooLarge && (
          <div className="px-4 py-2 bg-yellow-500/10 text-yellow-400 text-xs border-b border-border">
            ⚠ Large file ({file.additions + file.deletions} lines) — rendering may be slow
          </div>
        )}
        <ReactDiffViewer
          oldValue={file.oldContent}
          newValue={file.newContent}
          splitView={true}
          useDarkTheme={true}
          compareMethod={DiffMethod.WORDS}
          styles={diffStyles}
          renderContent={(str) => highlightSyntax(str, language)}
        />
      </div>
    )
  }, [file, language])

  return <div className="selectable">{body}</div>
}

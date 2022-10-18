import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import useWebSocket, { ReadyState } from 'react-use-websocket'
import { Switch } from '@headlessui/react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import { json } from 'react-syntax-highlighter/dist/cjs/languages/hljs'
import { lightfair as highlightStyle } from 'react-syntax-highlighter/dist/cjs/styles/hljs'

const utf8Decoder = new TextDecoder()
const utf8Encoder = new TextEncoder()

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

function Toggle({ defaultValue = false, onChange }) {
  const [enabled, setEnabled] = useState(defaultValue)

  useEffect(() => {
    onChange?.(enabled)
  }, [enabled, onChange])

  return (
    <Switch
      checked={enabled}
      onChange={setEnabled}
      className={classNames(
        enabled ? 'bg-indigo-600' : 'bg-gray-200',
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
      )}
    >
      <span className="sr-only">Auto-run</span>
      <span
        aria-hidden="true"
        className={classNames(
          enabled ? 'translate-x-5' : 'translate-x-0',
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
        )}
      />
    </Switch>
  )
}

function InputIcon({ size }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size}>
      <polygon points="50,75 35,50 65,50"/>
      <path d="M50,15 L50,55" fill="none" stroke="black" strokeWidth="10"/>
      <path d="M30,56 a30,16 0 1,0 40,0" fill="none" stroke="black" strokeWidth="7.5"/>
    </svg>
  )
}

function OutputIcon({ size }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size}>
      <polygon points="50,90 35,65 65,65"/>
      <path d="M50,25 L50,75" fill="none" stroke="black" strokeWidth="10"/>
      <path d="M36,44 a30,16 0 1,1 28,0" fill="none" stroke="black" strokeWidth="7.5"/>
    </svg>
  )
}

export default function Home() {
  SyntaxHighlighter.registerLanguage('json', json)

  const [autorun, setAutorun] = useState(false)
  const [connectionActive, setConnectionActive] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [pipeline, setPipeline] = useState([])
  const [record, setRecord] = useState(null)
  const [results, setResults] = useState(null)
  const [samples, setSamples] = useState([])
  const [sampleSize, setSampleSize] = useState(10)
  const [selected, setSelected] = useState(null)
  const [showConnectPanel, setShowConnectPanel] = useState(false)
  const [socketUrl, setSocketUrl] = useState('')
  const [workerErrors, setWorkerErrors] = useState([])
  const workerRef = useRef()
  const {lastMessage, readyState} = useWebSocket(socketUrl, {
    onClose: ({code, reason, wasClean}) => {
      if (!wasClean) {
        console.warn("WebSocket connection was closed abnormally", {code, reason})
      }
    },
    onError: (e) => {
      console.error("WebSocket connection error", e)
      setConnectionError("The connection experienced an error.")
      setConnectionActive(false)
    },
    onOpen: () => {
      console.info("WebSocket connection established")
    },
  }, connectionActive)

  useEffect(() => {
    (async() => {
      if (lastMessage !== null) {
        const sample = new Uint8Array(await lastMessage.data.arrayBuffer())
        setSamples(samples => samples.concat(sample).slice(-sampleSize))
      }
    })()
  }, [lastMessage, sampleSize, setSamples])

  useEffect(() => {
    setConnectionError('')
    setSamples([])
  }, [socketUrl])


  const selectedResult = useMemo(
    () => results?.byStage?.find(({ stageId }) => stageId === selected),
    [selected, results],
  )

  const toggleShowConnectPanel = () => setShowConnectPanel(v => !v)
  const toggleConnectionActive = () => setConnectionActive(v => !v)

  const onPipelineChanged = useCallback((p) => {
    setPipeline(p)
  }, [])
  const onRecordProcessed = useCallback((r) => {
    setResults(r)
  }, [])
  const onWorkerError = useCallback((e) => {
    setWorkerErrors((errors) => [...errors, e])
  }, [])

  useEffect(() => {
    workerRef.current = new Worker('/worker.js', { type: 'module' })
    workerRef.current.onmessage = function (msg) {
      const { name, args } = msg.data
      if (name === 'onPipelineChanged') {
        return onPipelineChanged(...args)
      }

      if (name === 'onRecordProcessed') {
        return onRecordProcessed(...args)
      }

      if (name === 'onWorkerError') {
        return onWorkerError(...args)
      }

      console.warn(`Worker cannot call function ${name}`)
    }

    if (pipeline?.length > 0) {
      workerRef.current?.postMessage({ name: 'loadStagesFromFiles', args: [pipeline?.map(({origin}) => origin)]}) // reload pipeline
    } 

    return () => {
      workerRef.current.terminate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFileInput = useCallback(
    async (e) => {
      const file = e.target.files[0]
      e.target.value = null
      try {
        workerRef.current?.postMessage({ name: 'loadStageFromFile', args: [file] })
      } catch (err) {
        setWorkerErrors(errors => [...errors, err])
      }
    },
    [workerRef],
  )

  const onRecordInputChange = useCallback((e) => {
    const r = e.target.value
    setRecord(utf8Encoder.encode(r))
  }, [])

  const onRemoveStage = useCallback(
    (id) => {
      workerRef.current?.postMessage({ name: 'removeStage', args: [id] })
    },
    [workerRef],
  )

  const onRun = useCallback(() => {
    if (record) {
      workerRef.current?.postMessage({ name: 'processRecord', args: [record] })
    }
  }, [record, workerRef])

  useEffect(() => {
    if (autorun) {
      onRun()
    }
  }, [autorun, pipeline, record, onRun])

  useEffect(() => {
    console.debug('pipeline', pipeline)
  }, [pipeline])

  useEffect(() => {
    console.debug('results', results)
  }, [results])

  useEffect(() => {
    console.debug('record', record)
  }, [record])

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {workerErrors?.map((error, idx) => 
        <div key={idx} className="bg-red-100 text-red-700 px-4 py-2 flex justify-between items-center">
          <div>{error.message}</div>
          <button className="text-xl text-black" onClick={() => setWorkerErrors(errors => [...errors.slice(0, idx), ...errors.slice(idx+1)])}>
            ✕
          </button>
        </div>
      )}
      <div className="flex flex-1 h-full w-full">
        <div className="mr-4 border-r-2 border-slate-200 border-solid flex flex-col items-center">
          <div className="flex-1 pt-4">
            <h2 className="w-full text-center mb-4 text-2xl font-bold">Pipeline</h2>
            <div className="text-xl pl-4 font-medium gap-y-2 flex flex-col">
              {pipeline?.map(({ id, origin }) => (
                <div
                  key={id}
                  className={classNames(
                    'rounded-l-md py-4 pl-4 pr-8 flex justify-between items-center hover:bg-blue-200 cursor-pointer',
                    selected === id ? 'bg-blue-100' : '',
                  )}
                  onClick={() => (selected === id ? setSelected(null) : setSelected(id))}
                >
                  <div
                    className={
                      results?.byStage
                        ?.find(({ stageId }) => stageId === id)
                        ?.results?.some(({ errors }) => errors?.length > 0)
                        ? 'text-red-600'
                        : ''
                    }
                  >
                    {origin.name}
                  </div>
                  <button className="text-lg text-black ml-4 hover:text-red-800" onClick={() => onRemoveStage(id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4">
            <label className="flex items-center justify-center text-blue-800 w-48 h-12 rounded-md cursor-pointer hover:bg-blue-100 ring-2 ring-blue-300 hover:ring-blue-400">
              <span className="font-bold text-xl">add stage</span>
              <input type="file" onChange={onFileInput} accept="application/wasm" className="hidden" />
            </label>
          </div>
        </div>
        <div className="flex-1 pl-2 pr-8 ml-2 flex-col flex pt-8 overflow-hidden">
          <div className="flex gap-x-4 relative">
            <textarea
              className="block bg-gray-50 pr-32 w-full font-mono resize-none border-0 py-3 focus:ring-1 rounded-md focus:ring-blue-400 ring-slate-200 break-all"
              placeholder="Add your log..."
              rows={8}
              onChange={onRecordInputChange}
              value={record ? utf8Decoder.decode(record) : ''}
            />
            <div className="absolute right-0 top-0 pt-4 pr-4 flex items-center gap-x-2 ">
              <span>autorun</span>
              <Toggle defaultValue={autorun} onChange={setAutorun} />
            </div>
            <div className="absolute right-0 bottom-0 pb-4 pr-4">
              <button
                disabled={autorun}
                className="bottom-0 right-0 bg-blue-800 text-white font-bold px-4 py-2 rounded-md disabled:hidden"
                onClick={onRun}
              >
                run
              </button>
            </div>
          </div>
          {selected ? null : (
            <div className="text-red-600">
              {results?.byStage?.map(({ stageId, results }) => (
                <div key={stageId}>
                  {results?.map(({ errors }) => (
                    <>
                      {errors?.length > 0 ? (
                        <div className="pl-2 pt-2">
                          <span className="font-bold mr-2">
                            {pipeline?.find(({ id }) => stageId === id)?.origin?.name}
                          </span>
                        </div>
                      ) : null}
                      {errors?.map((e, idx) => (
                        <div className="pl-4" key={idx}>
                          {e}
                        </div>
                      ))}
                    </>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="my-4 px-2 divide-y divide-slate-200 overflow-y-auto">
            {selectedResult ? (
              <>
                {selectedResult?.results?.map(({ input, outputs, errors }, idx) => (
                  <div key={idx} className="py-2">
                    <div className="flex">
                      <span className="mr-2">
                        <InputIcon size="26px"/>
                      </span>
                      <span className="font-bold text-blue-600 text-xl mr-2 whitespace-nowrap">{idx}.</span>
                      <SyntaxHighlighter language="json" style={highlightStyle} customStyle={{display: 'inline-block', padding: '0 .5em', wordBreak: "break-all"}} wrapLongLines={true}>
                        {utf8Decoder.decode(input)}
                      </SyntaxHighlighter>
                    </div>
                    {errors?.map((e, idx) => (
                      <div className="pl-4 py-1 text-red-600" key={idx}>
                        Error: {e}
                      </div>
                    ))}
                    <div>
                      {outputs?.map((o, idx) => (
                        <div key={idx} className="py-1 pl-4 flex">
                          <span className="mr-2">
                            <OutputIcon size="26px"/>
                          </span>
                          <span className="font-bold text-blue-600 mr-2 text-xl">{idx}.</span>
                          <SyntaxHighlighter language="json" style={highlightStyle} customStyle={{display: 'inline-block', padding: '0 .5em', wordBreak: "break-all"}} wrapLongLines={true}>
                            {utf8Decoder.decode(o)}
                          </SyntaxHighlighter>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              results?.outputs?.map((o, idx) => (
                <div key={idx} className="py-1 pl-4 flex">
                  <span className="mr-2">
                    <OutputIcon size="26px"/>
                  </span>
                  <span className="font-bold text-blue-600 text-xl mr-2">{idx}.</span>
                  <SyntaxHighlighter language="json" style={highlightStyle} customStyle={{display: 'inline-block', padding: '0 .5em', wordBreak: "break-all"}} wrapLongLines={true}>
                    {utf8Decoder.decode(o)}
                  </SyntaxHighlighter>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex transition-transform ease-in-out">
          <div className={classNames(showConnectPanel ? "" : "mr-[-600px]", "self-start mt-2 p-2 border-2 border-r-0 border-slate-200 border-solid rounded-l cursor-pointer transition-all duration-500 ease-in-out hover:bg-blue-100 hover:border-blue-400")} onClick={toggleShowConnectPanel}>
            <span className="font-bold rotate-180 pb-2" style={{writingMode: 'vertical-rl'}}>Connect</span>
          </div>
          <div className={classNames(showConnectPanel ? "translate-x-0" : "translate-x-full", "w-[600px] p-4 overflow-hidden border-l-2 border-solid border-slate-200 transition-transform duration-500 ease-in-out flex flex-col")}>
            <h2 className="text-xl font-bold self-center py-2">Log source</h2>
            <input type="url" pattern="wss?://" placeholder="WebSocket URL" className="m-2 disabled:bg-slate-100" disabled={readyState === ReadyState.OPEN} value={socketUrl} onInput={(e) => setSocketUrl(e.target.value)}></input>
            {connectionError ? <div className="text-red-600 self-end">{connectionError}</div> : null}
            <button className="m-2 p-2 w-48 text-blue-800 font-bold rounded-md cursor-pointer ring-2 ring-blue-300 hover:bg-blue-50" disabled={socketUrl === ''} onClick={toggleConnectionActive}>{connectionActive ? 'disconnect' : 'connect'}</button>
            <div className="divide-y divide-slate-200 overflow-scroll">
              {samples?.map((sample, idx) => <div key={idx}>
                <span className="text-mono p-2 block break-all cursor-pointer hover:bg-blue-50" onClick={() => setRecord(sample)}>{utf8Decoder.decode(sample)}</span>
              </div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Button } from '@/components/ui/button.js'
import { ContractDecoder, ERC20_ABI } from '@/lib/evm/contract-verification.js'
import { Copy, Eye, Code2 } from 'lucide-react'

interface HexDecoderProps {
  data: string
  contractAbi?: any[]
  className?: string
}

export function HexDecoder({ data, contractAbi, className }: HexDecoderProps) {
  const [showDecoded, setShowDecoded] = useState(true)
  
  if (!data || data === '0x') {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground italic">No data</p>
      </div>
    )
  }

  // Try to decode with provided ABI or fallback to ERC20
  const decoder = new ContractDecoder(contractAbi || ERC20_ABI)
  const decodedData = decoder.decodeCallData(data)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(data)
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-medium">Input Data</h4>
          {decodedData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDecoded(!showDecoded)}
            >
              {showDecoded ? <Code2 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showDecoded ? 'Show Raw' : 'Show Decoded'}
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={copyToClipboard}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>

      {showDecoded && decodedData ? (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium text-green-900">Function Call</h5>
              <code className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                {decodedData.functionName}
              </code>
            </div>
            <p className="text-sm text-green-700 font-mono mb-3">
              {decodedData.functionSignature}
            </p>
            
            {decodedData.parameters.length > 0 && (
              <div className="space-y-2">
                <h6 className="text-sm font-medium text-green-900">Parameters:</h6>
                {decodedData.parameters.map((param, idx) => (
                  <div key={idx} className="bg-white rounded p-2 border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">{param.name}</span>
                      <span className="text-xs text-gray-500">{param.type}</span>
                    </div>
                    <p className="text-sm font-mono break-all">{param.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-gray-900">Raw Hex Data</h5>
            <code className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
              {data.slice(0, 10)} {/* Function selector */}
            </code>
          </div>
          <p className="text-xs font-mono break-all text-gray-700 bg-white p-2 rounded border">
            {data}
          </p>
          {!decodedData && contractAbi && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ Could not decode with provided ABI
            </p>
          )}
          {!decodedData && !contractAbi && (
            <p className="text-xs text-gray-500 mt-2">
              💡 Contract verification needed for decoded view
            </p>
          )}
        </div>
      )}
    </div>
  )
}
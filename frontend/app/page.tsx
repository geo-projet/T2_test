'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, FileText, Loader2, Image as ImageIcon, Table } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import dynamic from 'next/dynamic';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// Dynamically import PDFViewer to avoid SSR issues
const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
});

interface Source {
  text: string;
  score: number;
  page_label: string;
  file_name: string;
  content_type: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Bonjour ! Je suis votre assistant environnemental expert. Posez-moi une question sur vos documents." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [selectedPDF, setSelectedPDF] = useState<{ fileName: string; pageNumber: number } | null>(null);

  // Debug: Log when selectedPDF changes
  useEffect(() => {
    console.log('selectedPDF state changed:', selectedPDF);
  }, [selectedPDF]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage }),
      });

      if (!response.ok) throw new Error('Erreur réseau');

      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.answer,
        sources: data.sources
      }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur est survenue lors de la connexion au serveur." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  console.log('Rendering component, selectedPDF:', selectedPDF);

  return (
    <>
      {selectedPDF && (
        <>
          {console.log('Rendering PDFViewer with:', selectedPDF)}
          <PDFViewer
            fileName={selectedPDF.fileName}
            pageNumber={selectedPDF.pageNumber}
            onClose={() => setSelectedPDF(null)}
          />
        </>
      )}

      <div className="flex h-screen bg-gray-50 p-4 justify-center items-center">
        <Card className="w-full max-w-4xl h-[90vh] flex flex-col shadow-xl">
        <CardHeader className="border-b bg-white rounded-t-xl">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-green-600" />
            <CardTitle>Assistant RAG Environnemental</CardTitle>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-hidden bg-white">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            <div className="space-y-6">
              {messages.map((msg, index) => (
                <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  
                  {msg.role === 'assistant' && (
                    <Avatar className="h-8 w-8 border">
                      <AvatarFallback className="bg-green-100 text-green-700">AI</AvatarFallback>
                    </Avatar>
                  )}

                  <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 rounded-lg shadow-sm text-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <div className="prose prose-sm dark:prose-invert break-words">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    </div>

                    {/* Sources Section */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 space-y-2 w-full">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sources Consultées</p>
                        <div className="grid grid-cols-1 gap-2">
                          {msg.sources.map((src, idx) => {
                            const contentIcon = src.content_type === 'figure' ? <ImageIcon className="h-3 w-3" /> :
                                               src.content_type === 'table' ? <Table className="h-3 w-3" /> :
                                               <FileText className="h-3 w-3" />;

                            return (
                              <div
                                key={idx}
                                onClick={() => {
                                  const pageNum = parseInt(src.page_label);
                                  console.log('Clicked source:', { fileName: src.file_name, pageLabel: src.page_label, pageNum });
                                  if (!isNaN(pageNum)) {
                                    console.log('Setting selected PDF:', { fileName: src.file_name, pageNumber: pageNum });
                                    setSelectedPDF({ fileName: src.file_name, pageNumber: pageNum });
                                  } else {
                                    console.error('Invalid page number:', src.page_label);
                                  }
                                }}
                                className="text-xs bg-gray-50 border p-2 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-2 font-medium text-gray-700">
                                  {contentIcon}
                                  <span className="group-hover:text-blue-600 transition-colors">
                                    {src.file_name} (Page {src.page_label})
                                  </span>
                                  <Badge
                                    variant={src.content_type === 'figure' ? 'secondary' : 'outline'}
                                    className="ml-auto text-[10px] h-4"
                                  >
                                    {src.content_type === 'figure' ? 'Figure' :
                                     src.content_type === 'table' ? 'Tableau' : 'Texte'}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    {src.score.toFixed(2)}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-gray-500 line-clamp-2 italic group-hover:line-clamp-none transition-all">
                                  &quot;{src.text}&quot;
                                </p>
                                <p className="mt-1 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Cliquer pour ouvrir le PDF
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                     <Avatar className="h-8 w-8 border">
                     <AvatarFallback className="bg-blue-100 text-blue-700">ME</AvatarFallback>
                   </Avatar>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start animate-pulse">
                   <Avatar className="h-8 w-8 border">
                      <AvatarFallback className="bg-green-100 text-green-700">AI</AvatarFallback>
                    </Avatar>
                    <div className="bg-gray-100 p-4 rounded-lg flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                      <span className="text-sm text-gray-500">Analyse des documents en cours...</span>
                    </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-4 border-t bg-white rounded-b-xl">
          <div className="flex w-full gap-2">
            <Input 
              placeholder="Posez une question sur vos rapports..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-green-600 hover:bg-green-700">
              <Send className="h-4 w-4" />
              <span className="sr-only">Envoyer</span>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
    </>
  );
}
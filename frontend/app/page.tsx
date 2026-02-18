'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, FileText, Loader2, Image as ImageIcon, Table, Globe, Microscope, LogOut, AlertCircle } from 'lucide-react';
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

// Dynamically import LoginPage to avoid SSR issues with localStorage
const LoginPage = dynamic(() => import('@/components/LoginPage'), {
  ssr: false,
});

interface Source {
  text: string;
  score: number;
  page_label: string;
  file_name: string;
  content_type: string;
  source_type: 'internal' | 'external';
  url?: string;
  title?: string;
  publication_info?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export default function ChatInterface() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authToken, setAuthToken] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Bonjour ! Je suis votre assistant environnemental expert. Posez-moi une question sur vos documents." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [selectedPDF, setSelectedPDF] = useState<{ fileName: string; pageNumber: number } | null>(null);
  const [searchMode, setSearchMode] = useState<'internal' | 'hybrid' | 'science'>('internal');

  // Vérifier l'authentification au chargement
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setAuthToken(token);
      setIsAuthenticated(true);
    }
    setIsCheckingAuth(false);
  }, []);

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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ query: userMessage, mode: searchMode }),
      });

      if (response.status === 401) {
        localStorage.removeItem('authToken');
        setIsAuthenticated(false);
        setAuthToken('');
        return;
      }

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

  const handleLogin = () => {
    const token = localStorage.getItem('authToken') || '';
    setAuthToken(token);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      await fetch(`${apiUrl}/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
    } catch { /* ignore */ }
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setAuthToken('');
  };

  // Afficher un loader pendant la vérification de l'authentification
  if (isCheckingAuth) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Si non authentifié, afficher la page de login
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <>
      {selectedPDF && (
        <PDFViewer
          fileName={selectedPDF.fileName}
          pageNumber={selectedPDF.pageNumber}
          onClose={() => setSelectedPDF(null)}
          token={authToken}
        />
      )}

      <div className="flex h-screen bg-gray-50 p-4 justify-center items-center">
        <Card className="w-full max-w-4xl h-[90vh] flex flex-col shadow-xl">
        <CardHeader className="border-b bg-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-green-600" />
              <CardTitle>Assistant RAG Environnemental</CardTitle>
            </div>

            {/* Sélecteur de mode et déconnexion */}
            <div className="flex gap-2">
              <Button
                variant={searchMode === 'internal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchMode('internal')}
                className={searchMode === 'internal' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <FileText className="h-3 w-3 mr-1" />
                Interne
              </Button>
              <Button
                variant={searchMode === 'hybrid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchMode('hybrid')}
                className={searchMode === 'hybrid' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                <Globe className="h-3 w-3 mr-1" />
                Hybride
              </Button>
              <Button
                variant={searchMode === 'science' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchMode('science')}
                className={searchMode === 'science' ? 'bg-purple-600 hover:bg-purple-700' : ''}
              >
                <Microscope className="h-3 w-3 mr-1" />
                Science
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="ml-2"
                title="Se déconnecter"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Bandeau d'avertissement mode Science */}
        {searchMode === 'science' && (
          <div className="flex items-start gap-2 px-4 py-2 bg-purple-50 border-b border-purple-200 text-xs text-purple-800">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-purple-600" />
            <span>
              <strong>Mode Science :</strong> votre question sera automatiquement traduite en anglais pour la recherche dans la littérature scientifique.
              La réponse sera affichée en français, suivie de la version originale en anglais.
            </span>
          </div>
        )}

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
                        <ReactMarkdown
                          components={{
                            h2: ({ children }) => (
                              <p className="font-bold text-gray-900 mt-3 mb-1">{children}</p>
                            ),
                            h3: ({ children }) => (
                              <p className="font-semibold text-gray-800 mt-2 mb-1">{children}</p>
                            ),
                          }}
                        >
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
                            const isExternal = src.source_type === 'external';

                            // Icône selon type
                            const contentIcon = isExternal ?
                              <Globe className="h-3 w-3" /> :
                              (src.content_type === 'figure' ? <ImageIcon className="h-3 w-3" /> :
                               src.content_type === 'table' ? <Table className="h-3 w-3" /> :
                               <FileText className="h-3 w-3" />);

                            return (
                              <div
                                key={idx}
                                onClick={() => {
                                  if (isExternal && src.url) {
                                    window.open(src.url, '_blank');
                                  } else {
                                    const pageNum = parseInt(src.page_label);
                                    if (!isNaN(pageNum)) {
                                      setSelectedPDF({ fileName: src.file_name, pageNumber: pageNum });
                                    }
                                  }
                                }}
                                className={`text-xs border p-2 rounded cursor-pointer group transition-colors ${
                                  isExternal
                                    ? 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-400'
                                    : 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 font-medium">
                                  {contentIcon}
                                  <span className={`group-hover:text-blue-600 ${isExternal ? 'text-blue-700' : 'text-gray-700'}`}>
                                    {isExternal ? src.title : `${src.file_name} (Page ${src.page_label})`}
                                  </span>

                                  {/* Badge type de source */}
                                  <Badge
                                    variant={isExternal ? 'default' : 'outline'}
                                    className={`ml-auto text-[10px] h-4 ${isExternal ? 'bg-blue-600' : ''}`}
                                  >
                                    {isExternal ? 'Externe' : 'Interne'}
                                  </Badge>

                                  {/* Badge type de contenu (interne seulement) */}
                                  {!isExternal && (
                                    <Badge variant="outline" className="text-[10px] h-4">
                                      {src.content_type === 'figure' ? 'Figure' :
                                       src.content_type === 'table' ? 'Tableau' : 'Texte'}
                                    </Badge>
                                  )}

                                  {/* Score */}
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    {src.score.toFixed(2)}
                                  </Badge>
                                </div>

                                {/* Extrait */}
                                <p className="mt-1 text-gray-500 line-clamp-2 group-hover:line-clamp-none">
                                  &quot;{src.text}&quot;
                                </p>

                                {/* Info publication (externe) */}
                                {isExternal && src.publication_info && (
                                  <p className="mt-1 text-[10px] text-blue-600 italic">
                                    {src.publication_info}
                                  </p>
                                )}

                                {/* Tooltip hover */}
                                <p className="mt-1 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100">
                                  {isExternal ? 'Cliquer pour ouvrir l\'article' : 'Cliquer pour ouvrir le PDF'}
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
                      <span className="text-sm text-gray-500">
                        {searchMode === 'internal'
                          ? 'Analyse des documents en cours...'
                          : searchMode === 'hybrid'
                          ? 'Analyse des documents et recherche web...'
                          : 'Analyse des documents et recherche littérature scientifique...'}
                      </span>
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

import React, { useState } from 'react';
import { Upload, File, X, Loader } from 'lucide-react';
import client from '../api/client';

const KnowledgeBase = ({ agentId }) => {
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    const handleFiles = async (files) => {
        setUploading(true);
        const formData = new FormData();

        Array.from(files).forEach(file => {
            formData.append('files', file);
        });
        formData.append('agent_id', agentId);

        try {
            const response = await client.post('/knowledge-base/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setDocuments([...documents, ...response.data]);
            alert('Documents uploaded successfully!');
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload documents');
        } finally {
            setUploading(false);
        }
    };

    const deleteDocument = async (docId) => {
        try {
            await client.delete(`/knowledge-base/documents/${docId}`);
            setDocuments(documents.filter(doc => doc.id !== docId));
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">Knowledge Base</h2>
                <p className="text-muted-foreground">Upload documents to enhance your agent's knowledge</p>
            </div>

            {/* Upload Area */}
            <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    id="file-upload"
                    multiple
                    accept=".pdf,.txt,.docx"
                    onChange={handleChange}
                    className="hidden"
                />

                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />

                {uploading ? (
                    <div className="flex items-center justify-center gap-2">
                        <Loader className="w-5 h-5 animate-spin" />
                        <span>Uploading...</span>
                    </div>
                ) : (
                    <>
                        <p className="text-lg mb-2">Drag and drop files here</p>
                        <p className="text-sm text-muted-foreground mb-4">or</p>
                        <label
                            htmlFor="file-upload"
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 inline-block"
                        >
                            Browse Files
                        </label>
                        <p className="text-xs text-muted-foreground mt-4">
                            Supported: PDF, TXT, DOCX (Max 10MB each)
                        </p>
                    </>
                )}
            </div>

            {/* Documents List */}
            {documents.length > 0 && (
                <div className="space-y-2">
                    <h3 className="font-semibold">Uploaded Documents</h3>
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 bg-card border border-border rounded-md"
                        >
                            <div className="flex items-center gap-3">
                                <File className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">{doc.filename}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {doc.file_size} bytes • {doc.chunk_count} chunks
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => deleteDocument(doc.id)}
                                className="p-1 hover:bg-destructive/10 rounded"
                            >
                                <X className="w-4 h-4 text-destructive" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default KnowledgeBase;

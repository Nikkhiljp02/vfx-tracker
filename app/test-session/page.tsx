"use client";

import { useSession } from "next-auth/react";

export default function TestSession() {
  const { data: session, status } = useSession();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Session Test</h1>
      
      <div className="bg-gray-800 p-4 rounded">
        <p className="mb-2"><strong>Status:</strong> {status}</p>
        <p className="mb-2"><strong>Session exists:</strong> {session ? "Yes" : "No"}</p>
        
        {session && (
          <div className="mt-4">
            <p><strong>User:</strong> {JSON.stringify(session.user, null, 2)}</p>
          </div>
        )}
        
        {!session && status === "unauthenticated" && (
          <p className="text-red-400 mt-4">No session found - not logged in</p>
        )}
      </div>
    </div>
  );
}

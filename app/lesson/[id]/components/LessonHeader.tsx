'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface LessonHeaderProps {
  title: string;
  activeSegmentIndex: number;
  totalSegments: number;
  progress: number;
}

export function LessonHeader({ title, activeSegmentIndex, totalSegments, progress }: LessonHeaderProps) {
  return (
    <header className="border-b bg-white/80 backdrop-blur-sm z-10">
      <div className="container mx-auto px-4 py-5 md:py-6">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-base font-semibold">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
          <div className="text-base font-medium text-gray-600">
            {totalSegments > 0 ? `${activeSegmentIndex + 1} / ${totalSegments}` : '0 / 0'}
          </div>
        </div>
        <Progress value={progress} className="mt-4" />
      </div>
    </header>
  );
}


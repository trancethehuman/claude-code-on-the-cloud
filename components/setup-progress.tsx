'use client';

import React from 'react';
import { Task, TaskContent, TaskItem, TaskTrigger } from './ai-elements/task';
import { CheckCircleIcon, AlertCircleIcon, Loader2Icon, CircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed';

export interface SetupTask {
  id: string;
  title: string;
  status: TaskStatus;
  description?: string;
  error?: string;
  details?: string[];
}

interface SetupProgressProps {
  tasks: SetupTask[];
  toolName: string;
}

const StatusIcon = ({ status }: { status: TaskStatus }) => {
  switch (status) {
    case 'pending':
      return <CircleIcon className="w-4 h-4 text-muted-foreground" />;
    case 'in-progress':
      return <Loader2Icon className="w-4 h-4 text-blue-600 animate-spin" />;
    case 'completed':
      return <CheckCircleIcon className="w-4 h-4 text-green-600" />;
    case 'failed':
      return <AlertCircleIcon className="w-4 h-4 text-red-600" />;
  }
};

const getStatusColor = (status: TaskStatus) => {
  switch (status) {
    case 'pending':
      return 'text-muted-foreground';
    case 'in-progress':
      return 'text-blue-600';
    case 'completed':
      return 'text-green-600';
    case 'failed':
      return 'text-red-600';
  }
};

export function SetupProgress({ tasks, toolName }: SetupProgressProps) {
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const totalTasks = tasks.length;
  const hasFailedTask = tasks.some(task => task.status === 'failed');
  const isComplete = completedTasks === totalTasks && !hasFailedTask;
  const hasActiveTask = tasks.some(task => task.status === 'in-progress');

  // Determine overall status for the main container
  const overallStatus: TaskStatus = hasFailedTask ? 'failed' : 
    isComplete ? 'completed' : 
    hasActiveTask ? 'in-progress' : 'pending';

  return (
    <div className="space-y-2">
      <Task defaultOpen={true}>
        <TaskTrigger 
          className="w-full"
          title={`Setting up ${toolName} (${completedTasks}/${totalTasks} ${isComplete ? 'complete' : 'in progress'})`}
        >
          <div className="flex items-center gap-3 w-full p-2 hover:bg-accent rounded-lg cursor-pointer">
            <StatusIcon status={overallStatus} />
            <div className="flex-1 text-left">
              <div className={cn("text-sm font-medium", getStatusColor(overallStatus))}>
                Setting up {toolName}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {completedTasks}/{totalTasks} {isComplete ? 'complete' : 'in progress'}
              </div>
            </div>
          </div>
        </TaskTrigger>

        <TaskContent>
          {tasks.map((task) => (
            <TaskItem key={task.id}>
              <div className="flex items-start gap-3 py-2">
                <StatusIcon status={task.status} />
                <div className="flex-1">
                  <div className={cn("text-sm font-medium", getStatusColor(task.status))}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {task.description}
                    </div>
                  )}
                  {task.error && (
                    <div className="text-red-600 text-xs mt-2">
                      ❌ Error: {task.error}
                    </div>
                  )}
                  {task.details && task.details.map((detail, index) => (
                    <div key={index} className="text-xs text-muted-foreground mt-1">
                      {detail}
                    </div>
                  ))}
                </div>
              </div>
            </TaskItem>
          ))}

          {isComplete && (
            <TaskItem>
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircleIcon className="w-5 h-5" />
                  <span className="font-medium">Setup Complete!</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  Your {toolName} environment is ready to use. You can now start chatting or switch to terminal mode.
                </p>
              </div>
            </TaskItem>
          )}

          {hasFailedTask && (
            <TaskItem>
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircleIcon className="w-5 h-5" />
                  <span className="font-medium">Setup Failed</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  One or more setup steps failed. Please check the details above and try creating a new sandbox.
                </p>
              </div>
            </TaskItem>
          )}
        </TaskContent>
      </Task>
    </div>
  );
}
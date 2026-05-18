import { getAllTodoTemplates } from '@/server/actions/todo-template'
import { TodoTemplatesClient } from './todo-templates-client'

export default async function TodoTemplatesPage() {
  const templates = await getAllTodoTemplates()
  return <TodoTemplatesClient templates={templates} />
}

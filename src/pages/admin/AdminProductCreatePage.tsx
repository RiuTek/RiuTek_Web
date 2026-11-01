import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ProductForm } from '../../features/admin/components/ProductForm'

export const AdminProductCreatePage: React.FC = () => {
  const [isSavingProduct, setIsSavingProduct] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/admin/products"
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Danh sách sản phẩm
          </Link>
          <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            Thêm Sản Phẩm Mới
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Nhập thông tin cơ bản, hình ảnh HTTPS và thông số kỹ thuật chuẩn theo loại linh kiện.
            Sau khi tạo thành công, bạn sẽ được chuyển tới trang chỉnh sửa và quản lý tồn kho.
          </p>
        </div>
      </div>

      <ProductForm
        mode="create"
        isSavingProduct={isSavingProduct}
        onSavingProductChange={setIsSavingProduct}
      />
    </div>
  )
}

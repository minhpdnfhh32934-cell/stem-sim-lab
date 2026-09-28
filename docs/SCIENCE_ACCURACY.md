# Độ chính xác khoa học — STEM Sim Lab

> Tài liệu này sẽ được nộp kèm hồ sơ dự thi. Mỗi giai đoạn sẽ bổ sung các mô hình mới.
> Trạng thái: **khung (Giai đoạn 0)**.

## 1. Nguyên tắc

- Mọi con số đều do engine tất định tính ra. AI (LLM) chỉ trích xuất dữ kiện đề bài và diễn giải
  kết quả bằng lời.
- Mỗi mô phỏng có **Thẻ Khoa học** ghi rõ: mô hình, phương trình, giả định, phạm vi hợp lệ, mức
  tin cậy và nguồn.
- Có ba mức tin cậy:
  - **Định lượng chính xác** (xanh lá): khớp lời giải giải tích trong sai số ghi rõ.
  - **Định lượng gần đúng** (vàng): tích phân số, có ghi sai số ước lượng.
  - **Định tính / minh họa** (xanh dương): không dùng để đọc số liệu.
- Khi hệ quá tải, app ưu tiên giữ độ chính xác và giảm độ mượt trước. App không bao giờ âm thầm
  giảm độ chính xác.

## 2. Nguồn dữ liệu chuẩn

| Loại                  | Nguồn                                |
| --------------------- | ------------------------------------ |
| Hằng số vật lý        | CODATA (NIST), bản mới nhất          |
| Khối lượng nguyên tử  | IUPAC                                |
| Độ âm điện            | Thang Pauling                        |
| Bán kính cộng hóa trị | Cordero et al., _Dalton Trans._ 2008 |
| Màu nguyên tố         | CPK / Jmol                           |
| Cấu trúc 3D phân tử   | PubChem (public domain)              |
| Mã di truyền          | NCBI translation table 1             |

## 3. Mô hình và kiểm chứng

_Sẽ bổ sung từ Giai đoạn 1 (bộ tích phân số và test so với lời giải giải tích)._
